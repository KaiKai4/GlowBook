import { describe, expect, it } from "vitest";
import { buildItemPayloads, type SchedulingContext } from "./scheduling";
import type { SalonConfig, ServiceAssignment } from "./types";

const salonId = "salon-1";

const salonConfig: SalonConfig = {
  timezone: "America/Panama",
  allow_off_hours_bookings: false,
  min_booking_notice_minutes: 0,
  min_appointment_duration_minutes: 15,
};

function assignment(overrides: Partial<ServiceAssignment> = {}): ServiceAssignment {
  return {
    service: {
      id: "service-1",
      duration_minutes: 30,
      price: 25,
      salon_id: salonId,
      is_active: true,
      category_id: "category-1",
    },
    employee: {
      id: "employee-1",
      salon_id: salonId,
      is_active: true,
      profile_id: null,
      service_ids: ["service-1", "service-2"],
      category_ids: ["category-1"],
    },
    ...overrides,
  };
}

function context(): SchedulingContext {
  return {
    salonConfig,
    businessHours: [{ day_of_week: 0, is_open: true, open_time: "08:00", close_time: "18:00" }],
    getWorkSchedules: () => [
      { day_of_week: 0, is_active: true, start_time: "08:00", end_time: "18:00" },
    ],
    getOccupiedSlots: () => [],
  };
}

describe("appointment scheduling", () => {
  it("builds sequential appointment items using each service duration", () => {
    const start = new Date("2026-05-25T14:00:00.000Z");
    const items = buildItemPayloads(
      salonId,
      start,
      [
        assignment(),
        assignment({
          service: {
            id: "service-2",
            duration_minutes: 45,
            price: 40,
            salon_id: salonId,
            is_active: true,
            category_id: "category-1",
          },
        }),
      ],
      context()
    );

    expect(items).toMatchObject([
      {
        service_id: "service-1",
        employee_id: "employee-1",
        duration_minutes: 30,
        price: 25,
        ordering: 1,
      },
      {
        service_id: "service-2",
        employee_id: "employee-1",
        duration_minutes: 45,
        price: 40,
        ordering: 2,
      },
    ]);
    expect(items[0].start_time.toISOString()).toBe("2026-05-25T14:00:00.000Z");
    expect(items[0].end_time.toISOString()).toBe("2026-05-25T14:30:00.000Z");
    expect(items[1].start_time.toISOString()).toBe("2026-05-25T14:30:00.000Z");
    expect(items[1].end_time.toISOString()).toBe("2026-05-25T15:15:00.000Z");
  });

  it("rejects a collaborator that does not perform the selected service", () => {
    expect(() =>
      buildItemPayloads(
        salonId,
        new Date("2026-05-25T14:00:00.000Z"),
        [assignment({ employee: { ...assignment().employee, service_ids: [] } })],
        context()
      )
    ).toThrow("no realiza ese servicio");
  });

  it("rejects a collaborator outside their schedule at the reordered item time", () => {
    const ctx = context();
    ctx.getWorkSchedules = () => [
      { day_of_week: 0, is_active: true, start_time: "08:00", end_time: "09:30" },
    ];

    expect(() =>
      buildItemPayloads(
        salonId,
        new Date("2026-05-25T14:00:00.000Z"),
        [
          assignment({ service: { ...assignment().service, duration_minutes: 60 } }),
          assignment(),
        ],
        ctx
      )
    ).toThrow("fuera del turno");
  });

  it("rejects occupied slots for the collaborator", () => {
    const ctx = context();
    ctx.getOccupiedSlots = () => [
      {
        start_time: "2026-05-25T14:15:00.000Z",
        end_time: "2026-05-25T14:45:00.000Z",
      },
    ];

    expect(() =>
      buildItemPayloads(
        salonId,
        new Date("2026-05-25T14:00:00.000Z"),
        [assignment()],
        ctx
      )
    ).toThrow("ya tiene una cita");
  });
});
