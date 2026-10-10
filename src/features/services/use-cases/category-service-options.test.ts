import { describe, expect, it, vi } from "vitest";
import { partialDouble } from "@/test/partial-double";
import { findCategoriesWithServices } from "../data/services.repo";
import { getCategoryServiceOptions } from "./category-service-options";

vi.mock("../data/services.repo", () => ({
  findCategoriesWithServices: vi.fn(),
}));

const mockedFindCategoriesWithServices = vi.mocked(findCategoriesWithServices);

type CategoryWithServices = Awaited<ReturnType<typeof findCategoriesWithServices>>[number];
type ServiceRow = CategoryWithServices["services"][number];

describe("category service options", () => {
  it("exposes category and service names for selectors", async () => {
    mockedFindCategoriesWithServices.mockResolvedValue([
      partialDouble<CategoryWithServices>({
        id: "category-1",
        name: "Cabello",
        services: [
          partialDouble<ServiceRow>({ id: "service-1", name: "Corte", is_active: true }),
          partialDouble<ServiceRow>({ id: "service-2", name: "Color", is_active: true }),
        ],
      }),
    ]);

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
      partialDouble<CategoryWithServices>({
        id: "category-1",
        name: "Cabello",
        services: [
          partialDouble<ServiceRow>({ id: "service-1", name: "Corte", is_active: true }),
          partialDouble<ServiceRow>({ id: "service-archivado", name: "Permanente antigua", is_active: false }),
        ],
      }),
    ]);

    await expect(getCategoryServiceOptions("salon-1")).resolves.toEqual([
      { id: "category-1", name: "Cabello", services: [{ id: "service-1", name: "Corte" }] },
    ]);
  });
});
