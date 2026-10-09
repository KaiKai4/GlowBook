import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCategoryServiceOptions } from "./category-service-options";
import { getServiceSchedulingOptions } from "./service-scheduling-options";

// Las filas de prueba son parciales a propósito: el doble no replica el tipo de Supabase.
const mockedFindCategories = vi.hoisted(() => vi.fn());

vi.mock("../data/services.repo", () => ({
  findCategoriesWithServices: mockedFindCategories,
}));

describe("opciones de servicios (categorias sin servicios)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("category-service-options devuelve categorias con lista vacia cuando no traen servicios", async () => {
    mockedFindCategories.mockResolvedValue([
      { id: "c1", name: "Cabello", services: null },
      { id: "c2", name: "Unas", services: undefined },
    ]);

    expect(await getCategoryServiceOptions("salon-1")).toEqual([
      { id: "c1", name: "Cabello", services: [] },
      { id: "c2", name: "Unas", services: [] },
    ]);
    expect(mockedFindCategories).toHaveBeenCalledWith("salon-1");
  });

  it("service-scheduling-options omite servicios inactivos y categorias sin servicios", async () => {
    mockedFindCategories.mockResolvedValue([
      {
        id: "c1",
        name: "Cabello",
        pricing_mode: "variable",
        services: [
          { id: "s1", name: "Corte", duration_minutes: 30, price: "12", is_active: true },
          { id: "s2", name: "Retirado", duration_minutes: 60, price: "5", is_active: false },
        ],
      },
      { id: "c2", name: "Vacia", pricing_mode: "fixed", services: null },
      { id: "c3", name: "Sin modo", services: [] },
    ]);

    const options = await getServiceSchedulingOptions("salon-1");

    expect(options.categories).toEqual([
      { id: "c1", name: "Cabello", pricing_mode: "variable" },
      { id: "c2", name: "Vacia", pricing_mode: "fixed" },
      { id: "c3", name: "Sin modo", pricing_mode: undefined },
    ]);
    expect(options.services).toEqual([
      { id: "s1", name: "Corte", category_id: "c1", duration_minutes: 30, price: 12 },
    ]);
  });
});
