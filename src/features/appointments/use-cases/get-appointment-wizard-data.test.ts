import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveCustomerOptions } from "@/features/customers/use-cases/customer-options";
import { getEmployeeSchedulingOptions } from "@/features/employees/use-cases/employee-scheduling-options";
import { getSalonSchedulingConfig } from "@/features/salon/use-cases/salon-scheduling-config";
import { getServiceSchedulingOptions } from "@/features/services/use-cases/service-scheduling-options";
import { getAppointmentWizardData } from "./get-appointment-wizard-data";

vi.mock("@/features/customers/use-cases/customer-options", () => ({
  getActiveCustomerOptions: vi.fn(),
}));

vi.mock("@/features/employees/use-cases/employee-scheduling-options", () => ({
  getEmployeeSchedulingOptions: vi.fn(),
}));

vi.mock("@/features/salon/use-cases/salon-scheduling-config", () => ({
  getSalonSchedulingConfig: vi.fn(),
}));

vi.mock("@/features/services/use-cases/service-scheduling-options", () => ({
  getServiceSchedulingOptions: vi.fn(),
}));

const mockedGetActiveCustomerOptions = vi.mocked(getActiveCustomerOptions);
const mockedGetEmployeeSchedulingOptions = vi.mocked(getEmployeeSchedulingOptions);
const mockedGetSalonSchedulingConfig = vi.mocked(getSalonSchedulingConfig);
const mockedGetServiceSchedulingOptions = vi.mocked(getServiceSchedulingOptions);

describe("get appointment wizard data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetActiveCustomerOptions.mockResolvedValue([]);
    mockedGetSalonSchedulingConfig.mockResolvedValue({
      salonConfig: {
        min_booking_notice_minutes: 0,
        min_appointment_duration_minutes: 30,
        allow_off_hours_bookings: false,
        timezone: "America/Panama",
      },
      businessHours: [],
    });
  });

  it("builds the wizard view from narrow scheduling Interfaces", async () => {
    mockedGetServiceSchedulingOptions.mockResolvedValue({
      categories: [{ id: "category-nails", name: "Unas" }],
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
    mockedGetEmployeeSchedulingOptions.mockResolvedValue([
      {
        id: "employee-1",
        name: "Valeria Castillo",
        service_ids: ["service-active"],
        category_ids: ["category-nails"],
        work_schedules: [],
      },
    ]);

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
    expect(mockedGetEmployeeSchedulingOptions).toHaveBeenCalledWith(
      "salon-1",
      new Set(["service-active"])
    );
    expect(view.ready).toBe(true);
  });

  it("returns not ready when there are no active services", async () => {
    mockedGetServiceSchedulingOptions.mockResolvedValue({
      categories: [{ id: "category-nails", name: "Unas" }],
      services: [],
    });
    mockedGetEmployeeSchedulingOptions.mockResolvedValue([
      {
        id: "employee-1",
        name: "Valeria Castillo",
        service_ids: [],
        category_ids: ["category-nails"],
        work_schedules: [],
      },
    ]);

    const view = await getAppointmentWizardData("salon-1");

    expect(view.services).toEqual([]);
    expect(view.ready).toBe(false);
  });
});
