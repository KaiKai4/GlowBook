// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServiceCatalog } from "@/features/services/use-cases/get-service-catalog";
import { hasPermission } from "@/features/access";
import { mountComponent, type MountedComponent } from "@/test/render-dom";
import { buildCategory } from "@/test/ui-people-fixtures";
import ServicesPage from "./page";
import { ServicesManager } from "./services-manager";

vi.mock("@/app/_composition/request-context", () => ({
  requireProfile: vi.fn(async () => ({ id: "user-1", salon_id: "salon-1" })),
}));

vi.mock("@/features/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/access")>()),
  hasPermission: vi.fn(),
}));

vi.mock("@/features/services/use-cases/get-service-catalog", () => ({
  getServiceCatalog: vi.fn(),
}));

vi.mock("./actions", () => ({
  archiveCategoryAction: vi.fn(),
  createCategoryAction: vi.fn(),
  createServiceAction: vi.fn(),
  updateCategoryPricingModeAction: vi.fn(),
  updateServiceAction: vi.fn(),
}));

describe("ServicesPage", () => {
  let mounted: MountedComponent | null = null;

  beforeEach(() => {
    vi.mocked(hasPermission).mockReset();
    vi.mocked(getServiceCatalog).mockReset();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  it("niega el acceso sin cargar el catálogo cuando el usuario no puede gestionar servicios", async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    mounted = mountComponent(await ServicesPage());

    expect(mounted.container.textContent).toContain("No tienes permiso para gestionar servicios.");
    expect(getServiceCatalog).not.toHaveBeenCalled();
  });

  it("carga el catálogo del salón y lo entrega al gestor de servicios", async () => {
    vi.mocked(hasPermission).mockReturnValue(true);
    const categories = [buildCategory({ id: "cat-1", name: "Cabello" })];
    vi.mocked(getServiceCatalog).mockResolvedValue(categories);

    const element = await ServicesPage();

    expect(getServiceCatalog).toHaveBeenCalledWith("salon-1");
    expect(element.type).toBe(ServicesManager);
    expect(element.props).toEqual({ categories });
  });
});
