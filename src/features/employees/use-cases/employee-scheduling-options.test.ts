import { describe, expect, it, vi } from "vitest";
import { findEmployees } from "../data/employees-read.repo";
import { getEmployeeSchedulingOptions } from "./employee-scheduling-options";

vi.mock("../data/employees-read.repo", () => ({
  findEmployees: vi.fn(),
}));

const mockedFindEmployees = vi.mocked(findEmployees);

describe("employee scheduling options", () => {
  it("returns active employee scheduling options and filters inactive services", async () => {
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
        work_schedules: [
          {
            day_of_week: 1,
            start_time: "09:00",
            end_time: "17:00",
            is_active: true,
          },
        ],
      },
    ] as Awaited<ReturnType<typeof findEmployees>>);

    await expect(
      getEmployeeSchedulingOptions("salon-1", new Set(["service-active"]))
    ).resolves.toEqual([
      {
        id: "employee-1",
        name: "Valeria Castillo",
        service_ids: ["service-active"],
        category_ids: ["category-nails"],
        work_schedules: [
          {
            day_of_week: 1,
            start_time: "09:00",
            end_time: "17:00",
            is_active: true,
          },
        ],
      },
    ]);

    expect(mockedFindEmployees).toHaveBeenCalledWith("salon-1", true);
  });
});
