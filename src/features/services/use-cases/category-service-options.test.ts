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
          { id: "service-1", name: "Corte" },
          { id: "service-2", name: "Color" },
        ],
      },
    ] as Awaited<ReturnType<typeof findCategoriesWithServices>>);

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
});
