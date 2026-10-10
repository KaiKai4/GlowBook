import { describe, expect, it } from "vitest";
import { buildSequentialSchedule, findEligibleEmployees } from "./wizard-availability";
import type {
  AppointmentServiceRow,
  OccupiedByEmployee,
} from "./wizard-availability";
import type { EmployeeOption, ServiceOption } from "../view-models";

const salonConfig = {
  timezone: "America/Panama",
  allow_off_hours_bookings: false,
  min_booking_notice_minutes: 0,
  min_appointment_duration_minutes: 15,
};

const businessHours = [
  { day_of_week: 3, is_open: true, open_time: "10:00", close_time: "17:00" },
];

const cutService: ServiceOption = {
  id: "service-cut",
  name: "Corte",
  category_id: "category-hair",
  duration_minutes: 30,
  price: 20,
};

const manicureService: ServiceOption = {
  id: "service-manicure",
  name: "Manicura",
  category_id: "category-nails",
  duration_minutes: 40,
  price: 15,
};

const serviceMap = new Map([
  [cutService.id, cutService],
  [manicureService.id, manicureService],
]);

function row(serviceId: string): AppointmentServiceRow {
  return {
    key: serviceId,
    categoryId: serviceMap.get(serviceId)?.category_id ?? "",
    serviceId,
    employeeId: "",
  };
}

function employee(overrides: Partial<EmployeeOption> = {}): EmployeeOption {
  return {
    id: "employee-1",
    name: "Colaborador Prueba",
    service_ids: [cutService.id],
    category_ids: [cutService.category_id],
    work_schedules: [],
    ...overrides,
  };
}

function eligible({
  serviceId = cutService.id,
  start = new Date("2026-05-28T15:00:00.000Z"),
  end = new Date("2026-05-28T15:30:00.000Z"),
  employees = [employee()],
  occupied = {},
}: {
  serviceId?: string;
  start?: Date;
  end?: Date;
  employees?: EmployeeOption[];
  occupied?: OccupiedByEmployee;
} = {}) {
  return findEligibleEmployees({
    serviceId,
    start,
    end,
    employees,
    serviceMap,
    salonConfig,
    businessHours,
    occupied,
  });
}

describe("appointment wizard availability", () => {
  it("filters collaborators by selected service and category", () => {
    const employees = [
      employee({ id: "hair", service_ids: [cutService.id], category_ids: [cutService.category_id] }),
      employee({
        id: "nails",
        service_ids: [manicureService.id],
        category_ids: [manicureService.category_id],
      }),
    ];

    expect(eligible({ serviceId: cutService.id, employees }).map((item) => item.id)).toEqual([
      "hair",
    ]);
  });

  it("blocks collaborators with an occupied appointment at that service time", () => {
    expect(
      eligible({
        occupied: {
          "employee-1": [
            {
              start_time: "2026-05-28T15:10:00.000Z",
              end_time: "2026-05-28T15:40:00.000Z",
            },
          ],
        },
      })
    ).toEqual([]);
  });

  it("blocks services that would end after the salón closes", () => {
    expect(
      eligible({
        serviceId: manicureService.id,
        start: new Date("2026-05-28T21:45:00.000Z"),
        end: new Date("2026-05-28T22:25:00.000Z"),
        employees: [
          employee({
            id: "nails",
            service_ids: [manicureService.id],
            category_ids: [manicureService.category_id],
          }),
        ],
      })
    ).toEqual([]);
  });

  it("recomputes item times when service rows are reordered", () => {
    const rows = [row(cutService.id), row(manicureService.id)];
    const schedule = buildSequentialSchedule({
      rows: rows.reverse(),
      date: "2026-05-28",
      time: "10:00",
      timeZone: "America/Panama",
      serviceMap,
    });

    expect(schedule[0]?.service?.id).toBe(manicureService.id);
    expect(schedule[0]?.start?.toISOString()).toBe("2026-05-28T15:00:00.000Z");
    expect(schedule[0]?.end?.toISOString()).toBe("2026-05-28T15:40:00.000Z");
    expect(schedule[1]?.service?.id).toBe(cutService.id);
    expect(schedule[1]?.start?.toISOString()).toBe("2026-05-28T15:40:00.000Z");
    expect(schedule[1]?.end?.toISOString()).toBe("2026-05-28T16:10:00.000Z");
  });
});
