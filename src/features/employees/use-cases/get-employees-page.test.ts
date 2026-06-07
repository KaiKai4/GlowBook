import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssignableRoleOptions } from "@/features/access/use-cases/role-options";
import { getCategoryServiceOptions } from "@/features/services/use-cases/category-service-options";
import { findEmployeeListRows } from "../data/employees.repo";
import { getEmployeesPage } from "./get-employees-page";

vi.mock("../data/employees.repo", () => ({
  findEmployeeListRows: vi.fn(),
}));

vi.mock("@/features/services/use-cases/category-service-options", () => ({
  getCategoryServiceOptions: vi.fn(),
}));

vi.mock("@/features/access/use-cases/role-options", () => ({
  getAssignableRoleOptions: vi.fn(),
}));

const mockedFindEmployeeListRows = vi.mocked(findEmployeeListRows);
const mockedGetCategoryServiceOptions = vi.mocked(getCategoryServiceOptions);
const mockedGetAssignableRoleOptions = vi.mocked(getAssignableRoleOptions);

describe("get employees page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployeeListRows.mockResolvedValue([]);
    mockedGetCategoryServiceOptions.mockResolvedValue([]);
    mockedGetAssignableRoleOptions.mockResolvedValue([]);
  });

  it("maps archived employee rows into a page view model", async () => {
    mockedFindEmployeeListRows.mockResolvedValue([
      {
        id: "employee-1",
        first_name: "Ana",
        last_name: "Vega",
        is_active: false,
        profile_id: "profile-1",
        services: [{ service: { id: "service-1" } }, { service: null }],
        categories: [
          { category: { id: "category-1", name: "Cabello" } },
          { category: null },
        ],
      },
    ] as never);
    mockedGetCategoryServiceOptions.mockResolvedValue([
      {
        id: "category-1",
        name: "Cabello",
        services: [{ id: "service-1", name: "Corte" }],
      },
    ] as never);
    mockedGetAssignableRoleOptions.mockResolvedValue([{ id: "role-1", name: "Recepcion" }]);

    const view = await getEmployeesPage({
      salonId: "salon-1",
      rolesEnabled: true,
      status: "archived",
    });

    expect(mockedFindEmployeeListRows).toHaveBeenCalledWith("salon-1", false);
    expect(view).toEqual({
      mode: "archived",
      employees: [
        {
          id: "employee-1",
          first_name: "Ana",
          last_name: "Vega",
          is_active: false,
          profile_id: "profile-1",
          serviceCount: 2,
          categories: ["Cabello"],
          categoryIds: ["category-1"],
        },
      ],
      categories: [
        {
          id: "category-1",
          name: "Cabello",
          services: [{ id: "service-1", name: "Corte" }],
        },
      ],
      roles: [{ id: "role-1", name: "Recepcion" }],
    });
  });

  it("does not load roles when the salon feature is disabled", async () => {
    await getEmployeesPage({ salonId: "salon-1", rolesEnabled: false });

    expect(mockedGetAssignableRoleOptions).not.toHaveBeenCalled();
  });
});
