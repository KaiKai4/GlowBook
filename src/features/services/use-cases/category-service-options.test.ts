import { describe, expect, it, vi } from "vitest";
import { findCategoriesWithServices } from "../data/services.repo";
import { getCategoryServiceOptions } from "./category-service-options";

vi.mock("../data/services.repo", () => ({
  findCategoriesWithServices: vi.fn(),
}));

const mockedFindCategoriesWithServices = vi.mocked(findCategoriesWithServices);

describe("category service options", () => {
  it("exposes category and service names for selectors", async () => {
    mockedFindCategoriesWithServices.mockResolvedValue([
      {
        id: "category-1",
        name: "Cabello",
        services: [
          { id: "service-1", name: "Corte", is_active: true },
          { id: "service-2", name: "Color", is_active: true },
        ],
      },
    ] as unknown as Awaited<ReturnType<typeof findCategoriesWithServices>>);

    await expect(getCategoryServiceOptions("salon-1")).resolves.toEqual([
      {
        id: "category-1",
        name: "Cabello",
        services: [
          { id: "service-1", name: "Corte" },
          { id: "service-2", name: "Color" },
        ],
      },
    ]);
  });

  it("no ofrece servicios inactivos en los selectores de asignacion", async () => {
    mockedFindCategoriesWithServices.mockResolvedValue([
      {
        id: "category-1",
        name: "Cabello",
        services: [
          { id: "service-1", name: "Corte", is_active: true },
          { id: "service-archivado", name: "Permanente antigua", is_active: false },
        ],
      },
    ] as unknown as Awaited<ReturnType<typeof findCategoriesWithServices>>);

    await expect(getCategoryServiceOptions("salon-1")).resolves.toEqual([
      { id: "category-1", name: "Cabello", services: [{ id: "service-1", name: "Corte" }] },
    ]);
  });
});
