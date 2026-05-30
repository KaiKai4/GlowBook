import { beforeEach, describe, expect, it, vi } from "vitest";
import { findServicesCatalog } from "../data/services.repo";
import { getServiceCatalog } from "./get-service-catalog";

vi.mock("../data/services.repo", () => ({
  findServicesCatalog: vi.fn(),
}));

const mockedFindServicesCatalog = vi.mocked(findServicesCatalog);

describe("get service catalog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps catalog rows into the UI view model and hides inactive collaborators", async () => {
    mockedFindServicesCatalog.mockResolvedValue([
      {
        id: "category-1",
        name: "Cabello",
        ordering: 1,
        services: [
          {
            id: "service-1",
            name: "Corte",
            duration_minutes: 30,
            price: "25.50",
            is_active: true,
            employee_services: [
              {
                employee: {
                  id: "employee-1",
                  first_name: "Ana",
                  last_name: "Vega",
                  is_active: true,
                },
              },
              {
                employee: {
                  id: "employee-2",
                  first_name: "Luis",
                  last_name: "Mora",
                  is_active: false,
                },
              },
              { employee: null },
            ],
          },
        ],
      },
    ] as never);

    await expect(getServiceCatalog("salon-1")).resolves.toEqual([
      {
        id: "category-1",
        name: "Cabello",
        services: [
          {
            id: "service-1",
            name: "Corte",
            duration_minutes: 30,
            price: 25.5,
            is_active: true,
            employees: [{ id: "employee-1", initials: "AV", name: "Ana Vega" }],
          },
        ],
      },
    ]);
    expect(mockedFindServicesCatalog).toHaveBeenCalledWith("salon-1");
  });
});
