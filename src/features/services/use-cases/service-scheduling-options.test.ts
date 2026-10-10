import { describe, expect, it, vi } from "vitest";
import { findCategoriesWithServices } from "../data/services.repo";
import { getServiceSchedulingOptions } from "./service-scheduling-options";

vi.mock("../data/services.repo", () => ({
  findCategoriesWithServices: vi.fn(),
}));

const mockedFindCategoriesWithServices = vi.mocked(findCategoriesWithServices);

describe("service scheduling options", () => {
  it("returns active services and category options for scheduling", async () => {
    mockedFindCategoriesWithServices.mockResolvedValue([
      {
        id: "category-nails",
        name: "Unas",
        pricing_mode: "fixed",
        services: [
          {
            id: "service-active",
            name: "Softgel",
            duration_minutes: 45,
            price: 31,
            is_active: true,
          },
          {
            id: "service-inactive",
            name: "Manicura",
            duration_minutes: 30,
            price: 15,
            is_active: false,
          },
        ],
      },
    ] as Awaited<ReturnType<typeof findCategoriesWithServices>>);

    await expect(getServiceSchedulingOptions("salon-1")).resolves.toEqual({
      categories: [{ id: "category-nails", name: "Unas", pricing_mode: "fixed" }],
      services: [
        {
          id: "service-active",
          name: "Softgel",
          category_id: "category-nails",
          duration_minutes: 45,
          price: 31,
        },
      ],
    });
  });

  it("incluye los servicios inactivos indicados, marcados como (inactivo), y sigue ocultando el resto", async () => {
    mockedFindCategoriesWithServices.mockResolvedValue([
      {
        id: "category-nails",
        name: "Unas",
        pricing_mode: "fixed",
        services: [
          { id: "service-active", name: "Softgel", duration_minutes: 45, price: 31, is_active: true },
          { id: "service-kept", name: "Manicura", duration_minutes: 30, price: 15, is_active: false },
          { id: "service-other", name: "Pedicura", duration_minutes: 40, price: 20, is_active: false },
        ],
      },
    ] as Awaited<ReturnType<typeof findCategoriesWithServices>>);

    const options = await getServiceSchedulingOptions("salon-1", ["service-kept"]);

    expect(options.services.map((service) => service.id)).toEqual(["service-active", "service-kept"]);
    expect(options.services[1]?.name).toBe("Manicura (inactivo)");
    expect(options.services[0]?.name).toBe("Softgel");
  });
});
