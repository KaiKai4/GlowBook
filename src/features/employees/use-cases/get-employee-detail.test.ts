import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssignableRoleOptions } from "@/features/access/use-cases/role-options";
import { getCategoryServiceOptions } from "@/features/services/use-cases/category-service-options";
import { findEmployeeAccessProfile } from "../data/employee-access.repo";
import { findEmployeeById, findLatestEmployeeInvitation } from "../data/employees.repo";
import { getEmployeeDetail } from "./get-employee-detail";

vi.mock("../data/employees.repo", () => ({
  findEmployeeById: vi.fn(),
  findLatestEmployeeInvitation: vi.fn(),
}));

vi.mock("../data/employee-access.repo", () => ({
  findEmployeeAccessProfile: vi.fn(),
}));

vi.mock("@/features/services/use-cases/category-service-options", () => ({
  getCategoryServiceOptions: vi.fn(),
}));

vi.mock("@/features/access/use-cases/role-options", () => ({
  getAssignableRoleOptions: vi.fn(),
}));

const mockedFindEmployeeById = vi.mocked(findEmployeeById);
const mockedFindLatestEmployeeInvitation = vi.mocked(findLatestEmployeeInvitation);
const mockedFindEmployeeAccessProfile = vi.mocked(findEmployeeAccessProfile);
const mockedGetCategoryServiceOptions = vi.mocked(getCategoryServiceOptions);
const mockedGetAssignableRoleOptions = vi.mocked(getAssignableRoleOptions);

const baseEmployee = {
  id: "employee-1",
  first_name: "Ana",
  last_name: "Vega",
  phone: null,
  email: "ana@example.com",
  specialty: null,
  commission_percentage: "15.5",
  profile_id: null,
  is_active: true,
  services: [{ service: { id: "service-1", name: "Corte" } }, { service: null }],
  categories: [{ category: { id: "category-1", name: "Cabello" } }],
  work_schedules: [
    {
      id: "schedule-1",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "17:00",
      is_active: true,
    },
  ],
};

describe("get employee detail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindEmployeeById.mockResolvedValue(baseEmployee as never);
    mockedFindLatestEmployeeInvitation.mockResolvedValue(null);
    mockedFindEmployeeAccessProfile.mockResolvedValue({ data: null, error: null });
    mockedGetCategoryServiceOptions.mockResolvedValue([]);
    mockedGetAssignableRoleOptions.mockResolvedValue([]);
  });

  it("maps employee detail rows and pending invitation state", async () => {
    mockedFindLatestEmployeeInvitation.mockResolvedValue({
      id: "invitation-1",
      token: "token-1",
      email: "ana@example.com",
      role_id: "role-1",
      expires_at: "2026-06-05T00:00:00.000Z",
      accepted_at: null,
    });
    mockedGetCategoryServiceOptions.mockResolvedValue([
      {
        id: "category-1",
        name: "Cabello",
        services: [{ id: "service-1", name: "Corte" }],
      },
    ]);
    mockedGetAssignableRoleOptions.mockResolvedValue([{ id: "role-1", name: "Recepcion" }]);

    const view = await getEmployeeDetail({
      employeeId: "employee-1",
      salonId: "salon-1",
      rolesEnabled: true,
      now: new Date("2026-05-29T00:00:00.000Z"),
    });

    expect(view).toMatchObject({
      employee: {
        id: "employee-1",
        phone: "",
        email: "ana@example.com",
        specialty: "",
        commission_percentage: 15.5,
      },
      services: [{ id: "service-1", name: "Corte" }],
      categories: [{ id: "category-1", name: "Cabello" }],
      schedules: [
        {
          id: "schedule-1",
          day_of_week: 1,
          start_time: "09:00",
          end_time: "17:00",
        },
      ],
      pendingInvitation: {
        token: "token-1",
        expiresAt: "2026-06-05T00:00:00.000Z",
        roleId: "role-1",
      },
      roleOptions: [{ id: "role-1", name: "Recepcion" }],
      categoryOptions: [
        {
          id: "category-1",
          name: "Cabello",
          services: [{ id: "service-1", name: "Corte" }],
        },
      ],
    });
  });

  it("loads the linked profile role and skips invitation lookup", async () => {
    mockedFindEmployeeById.mockResolvedValue({
      ...baseEmployee,
      profile_id: "profile-1",
    } as never);
    mockedFindEmployeeAccessProfile.mockResolvedValue({
      data: { role_id: "role-2", is_owner: false },
      error: null,
    });

    const view = await getEmployeeDetail({
      employeeId: "employee-1",
      salonId: "salon-1",
      rolesEnabled: true,
    });

    expect(view?.currentRoleId).toBe("role-2");
    expect(mockedFindLatestEmployeeInvitation).not.toHaveBeenCalled();
  });
});
