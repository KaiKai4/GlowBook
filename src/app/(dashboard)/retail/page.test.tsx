// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRetailPage, type RetailPageView } from "@/features/retail/use-cases/retail-sales";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission } from "@/lib/auth/permissions";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import RetailPage from "./page";
import { RetailManager } from "./retail-manager";

vi.mock("@/lib/auth/session", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/lib/auth/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/permissions")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/billing/use-cases/commercial-plans", () => ({
  isEffectiveSalonModuleEnabled: vi.fn(),
}));

vi.mock("@/features/retail/use-cases/retail-sales", () => ({
  getRetailPage: vi.fn(),
}));

vi.mock("./retail-manager", () => ({
  RetailManager: vi.fn(() => null),
}));

describe("RetailPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(isEffectiveSalonModuleEnabled).mockReset();
    vi.mocked(getRetailPage).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega el acceso sin cargar la vitrina cuando el módulo no está activo", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(false);
    vi.mocked(hasPermission).mockReturnValue(true);

    mounted = mountComponent(await RetailPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar vitrina.");
    expect(mounted.container.querySelector("h1")).toBeNull();
    expect(getRetailPage).not.toHaveBeenCalled();
  });

  it("muestra el título Vitrina con su descripción y entrega los datos al gestor", async () => {
    vi.mocked(isEffectiveSalonModuleEnabled).mockResolvedValue(true);
    vi.mocked(hasPermission).mockReturnValue(true);
    const retail = { products: [], customers: [], recentSales: [], paymentMethodOptions: [] } as RetailPageView;
    vi.mocked(getRetailPage).mockResolvedValue(retail);

    mounted = mountComponent(await RetailPage());

    expect(mounted.container.querySelector("h1")?.textContent).toBe("Vitrina");
    expect(mounted.container.textContent).toContain(
      "Registra ventas de productos y descuenta inventario automaticamente."
    );
    expect(getRetailPage).toHaveBeenCalledWith("salon-1");
    expect(vi.mocked(RetailManager).mock.calls[0]?.[0]).toEqual({ retail });
  });
});
