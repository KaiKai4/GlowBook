import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveCommercialAddon,
  countAddonAssignments,
  deleteCommercialAddon,
  saveCommercialAddon,
} from "../data/commercial-addons.repo";
import { publishAuditEvent } from "@/features/audit";
import { err, ok } from "@/lib/result";
import { removeCommercialAddonConfig, saveCommercialAddonConfig } from "./commercial-addons";

// Catálogo de extras: el guardado normaliza código y moneda y limpia los campos
// que no aplican al tipo; la eliminación archiva si hay asignaciones y borra si no.

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

const saveMock = vi.mocked(saveCommercialAddon);
const archiveMock = vi.mocked(archiveCommercialAddon);
const deleteMock = vi.mocked(deleteCommercialAddon);
const countMock = vi.mocked(countAddonAssignments);
const auditMock = vi.mocked(publishAuditEvent);

beforeEach(() => {
  vi.clearAllMocks();
  saveMock.mockResolvedValue(ADDON_ID);
  archiveMock.mockResolvedValue(undefined);
  deleteMock.mockResolvedValue(undefined);
  countMock.mockResolvedValue(0);
  auditMock.mockReset();
});

describe("saveCommercialAddonConfig", () => {
  it("normaliza el código desde el nombre, pone la moneda en mayúsculas y limpia el tipo módulo", async () => {
    const result = await saveCommercialAddonConfig(
      {
        name: "  Analítica Avanzada  ",
        kind: "module",
        moduleKey: "reports",
        metricKey: "customers_active",
        limitDelta: 40,
        currency: "usd",
        monthlyPrice: "12.5",
      },
      ACTOR_ID
    );

    expect(result).toEqual(ok(ADDON_ID));
    expect(saveMock).toHaveBeenCalledWith({
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
    expect(auditMock).toHaveBeenCalledWith("billing.addon_saved", 
      expect.objectContaining({ actorUserId: ACTOR_ID, action: "commercial_addon_saved", targetResourceId: ADDON_ID })
    );
  });

  it("usa el código explícito normalizado y, en tipo límite, descarta el módulo", async () => {
    await saveCommercialAddonConfig({
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
    });

    expect(saveMock).toHaveBeenCalledWith(
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
    const result = await saveCommercialAddonConfig({
      name: "Clientes",
      kind: "limit_boost",
      metricKey: "customers_active",
      limitDelta: "",
      monthlyPrice: 4,
    });

    expect(result.ok).toBe(false);
    expect(saveMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("devuelve el prefijo propio cuando el repositorio falla, sin auditar", async () => {
    saveMock.mockRejectedValueOnce(new Error("constraint"));

    const result = await saveCommercialAddonConfig({
      name: "Reportes",
      kind: "module",
      moduleKey: "reports",
      monthlyPrice: 10,
    });

    expect(result).toEqual(err(expect.stringContaining("No se pudo guardar el extra.")));
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("devuelve el prefijo propio sin detalle cuando el fallo no es un Error", async () => {
    saveMock.mockRejectedValueOnce("fallo sin detalle");

    const result = await saveCommercialAddonConfig({
      name: "Reportes",
      kind: "module",
      moduleKey: "reports",
      monthlyPrice: 10,
    });

    expect(result).toEqual(err("No se pudo guardar el extra."));
  });
});

describe("removeCommercialAddonConfig", () => {
  it("archiva el extra con asignaciones existentes y audita el archivado", async () => {
    countMock.mockResolvedValueOnce(3);

    const result = await removeCommercialAddonConfig(ADDON_ID, ACTOR_ID);

    expect(result).toEqual(ok(undefined));
    expect(archiveMock).toHaveBeenCalledWith(ADDON_ID);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith("billing.addon_archived", 
      expect.objectContaining({ action: "commercial_addon_archived", actorUserId: ACTOR_ID, targetResourceId: ADDON_ID })
    );
  });

  it("borra el extra sin asignaciones y audita el borrado con actor nulo por defecto", async () => {
    const result = await removeCommercialAddonConfig(ADDON_ID);

    expect(result).toEqual(ok(undefined));
    expect(deleteMock).toHaveBeenCalledWith(ADDON_ID);
    expect(archiveMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith("billing.addon_deleted", 
      expect.objectContaining({ action: "commercial_addon_deleted", actorUserId: null, targetResourceId: ADDON_ID })
    );
  });

  it("devuelve el prefijo propio cuando el conteo o el borrado fallan", async () => {
    countMock.mockRejectedValueOnce(new Error("timeout"));

    expect(await removeCommercialAddonConfig(ADDON_ID)).toEqual(
      err(expect.stringContaining("No se pudo eliminar el extra."))
    );

    countMock.mockResolvedValueOnce(0);
    deleteMock.mockRejectedValueOnce(new Error("bloqueado"));
    expect(await removeCommercialAddonConfig(ADDON_ID)).toEqual(
      err(expect.stringContaining("No se pudo eliminar el extra."))
    );
    expect(auditMock).not.toHaveBeenCalled();
  });
});
