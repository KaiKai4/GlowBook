// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getInventoryPage, type InventoryPageView } from "@/features/inventory/use-cases/inventory-products";
import { isEffectiveSalonModuleEnabled } from "@/features/billing";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import InventoryPage from "./page";
import { InventoryManager } from "./inventory-manager";

vi.mock("@/app/_composition/request-context", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/billing", () => ({
  salonModuleScopeFromProfile: vi.fn((profile: unknown) => profile),
  isEffectiveSalonModuleEnabled: vi.fn(),
}));

vi.mock("@/features/inventory/use-cases/inventory-products", () => ({
  getInventoryPage: vi.fn(),
}));

const VIEW: InventoryPageView = {
  products: [],
  lowStock: [],
  recentMovements: [],
};

describe("InventoryPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(isEffectiveSalonModuleEnabled).mockReset();
    vi.mocked(getInventoryPage).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega el acceso sin cargar datos cuando el módulo de inventario está desactivado", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
    vi.mocked(hasPermission).mockReturnValue(true);

    mounted = mountComponent(await InventoryPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar inventario.");
    expect(getInventoryPage).not.toHaveBeenCalled();
  });

  it("niega el acceso cuando falta el permiso de inventario", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await InventoryPage());

    expect(hasPermission).toHaveBeenCalledWith({ id: "user-1", salon_id: "salon-1" }, PERMISSIONS.INVENTORY_MANAGE);
    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar inventario.");
    expect(getInventoryPage).not.toHaveBeenCalled();
  });

  it("carga el inventario del salón cuando el módulo y el permiso están activos", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(getInventoryPage).mockResolvedValue(VIEW);

    const element = await InventoryPage();

    expect(getInventoryPage).toHaveBeenCalledWith("salon-1");
    expect(element.props.children[1].type).toBe(InventoryManager);
    expect(element.props.children[1].props).toEqual({ inventory: VIEW });
  });
});
