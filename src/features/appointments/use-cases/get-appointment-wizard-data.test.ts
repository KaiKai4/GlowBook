import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCustomers } from "@/features/customers/data/customers.repo";
import { findEmployees } from "@/features/employees/data/employees.repo";
import {
  findAppointmentSalonConfig,
  findBusinessHours,
} from "@/features/salon/data/salon.repo";
import { findCategoriesWithServices } from "@/features/services/data/services.repo";
import { getAppointmentWizardData } from "./get-appointment-wizard-data";

vi.mock("@/features/customers/data/customers.repo", () => ({
  findCustomers: vi.fn(),
}));

vi.mock("@/features/employees/data/employees.repo", () => ({
  findEmployees: vi.fn(),
}));

vi.mock("@/features/salon/data/salon.repo", () => ({
  findAppointmentSalonConfig: vi.fn(),
  findBusinessHours: vi.fn(),
}));

vi.mock("@/features/services/data/services.repo", () => ({
  findCategoriesWithServices: vi.fn(),
}));

const mockedFindCustomers = vi.mocked(findCustomers);
const mockedFindEmployees = vi.mocked(findEmployees);
const mockedFindAppointmentSalonConfig = vi.mocked(findAppointmentSalonConfig);
const mockedFindBusinessHours = vi.mocked(findBusinessHours);
const mockedFindCategoriesWithServices = vi.mocked(findCategoriesWithServices);

describe("get appointment wizard data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindCustomers.mockResolvedValue({ data: [], total: 0 });
    mockedFindAppointmentSalonConfig.mockResolvedValue(null);
    mockedFindBusinessHours.mockResolvedValue([]);
  });

  it("hides inactive services and removes them from employee eligibility", async () => {
    mockedFindCategoriesWithServices.mockResolvedValue([
      {
        id: "category-nails",
        name: "Uñas",
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
            name: "Manicura tradicional",
            duration_minutes: 30,
            price: 15,
            is_active: false,
          },
        ],
      },
    ] as never);
    mockedFindEmployees.mockResolvedValue([
      {
        id: "employee-1",
        first_name: "Valeria",
        last_name: "Castillo",
        services: [
          { service: { id: "service-active" } },
          { service: { id: "service-inactive" } },
        ],
        categories: [{ category: { id: "category-nails" } }],
        work_schedules: [],
      },
    ] as never);

    const view = await getAppointmentWizardData("salon-1");

    expect(view.services).toEqual([
      {
        id: "service-active",
        name: "Softgel",
        category_id: "category-nails",
        duration_minutes: 45,
        price: 31,
      },
    ]);
    expect(view.employees[0].service_ids).toEqual(["service-active"]);
    expect(view.ready).toBe(true);
  });
});
