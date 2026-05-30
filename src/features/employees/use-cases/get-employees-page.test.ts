import { beforeEach, describe, expect, it, vi } from "vitest";
import { findRolesWithPermissions } from "@/features/access/data/roles.repo";
import { findCategoriesWithServices } from "@/features/services/data/services.repo";
import { findEmployees } from "../data/employees.repo";
import { getEmployeesPage } from "./get-employees-page";

vi.mock("../data/employees.repo", () => ({
  findEmployees: vi.fn(),
}));

vi.mock("@/features/services/data/services.repo", () => ({
  findCategoriesWithServices: vi.fn(),
}));

vi.mock("@/features/access/data/roles.repo", () => ({
  findRolesWithPermissions: vi.fn(),
}));

const mockedFindEmployees = vi.mocked(findEmployees);
const mockedFindCategoriesWithServices = vi.mocked(findCategoriesWithServices);
const mockedFindRolesWithPermissions = vi.mocked(findRolesWithPermissions);

describe("get employees page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployees.mockResolvedValue([]);
    mockedFindCategoriesWithServices.mockResolvedValue([]);
    mockedFindRolesWithPermissions.mockResolvedValue([]);
  });

  it("maps archived employee rows into a page view model", async () => {
    mockedFindEmployees.mockResolvedValue([
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
    mockedFindCategoriesWithServices.mockResolvedValue([
      {
        id: "category-1",
        name: "Cabello",
        services: [{ id: "service-1", name: "Corte" }],
      },
    ] as never);
    mockedFindRolesWithPermissions.mockResolvedValue([
      {
        id: "role-1",
        salon_id: "salon-1",
        name: "Recepcion",
        is_system: false,
        role_permissions: [],
      },
      {
        id: "role-system",
        salon_id: "salon-1",
        name: "Owner",
        is_system: true,
        role_permissions: [],
      },
    ]);

    const view = await getEmployeesPage({
      salonId: "salon-1",
      rolesEnabled: true,
      status: "archived",
    });

    expect(mockedFindEmployees).toHaveBeenCalledWith("salon-1", false);
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

    expect(mockedFindRolesWithPermissions).not.toHaveBeenCalled();
  });
});
