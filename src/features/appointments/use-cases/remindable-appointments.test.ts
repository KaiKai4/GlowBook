import { describe, expect, it, vi } from "vitest";
import { findAppointmentsBySalon } from "../data/appointments.repo";
import { getRemindableAppointments } from "./remindable-appointments";

vi.mock("../data/appointments.repo", () => ({
  findAppointmentsBySalon: vi.fn(),
}));

const mockedFindAppointmentsBySalon = vi.mocked(findAppointmentsBySalon);

function appointment(status: string) {
  return {
    id: `appt-${status}`,
    status,
    start_time: "2026-05-29T15:00:00.000Z",
    total_price: 35,
    customer: null,
    items: [],
  };
}

describe("remindable appointments", () => {
  it("returns only appointments that should receive operational reminders", async () => {
    mockedFindAppointmentsBySalon.mockResolvedValue([
      appointment("scheduled"),
      appointment("confirmed"),
      appointment("completed"),
      appointment("cancelled"),
      appointment("no_show"),
    ] as unknown as Awaited<ReturnType<typeof findAppointmentsBySalon>>);

    await expect(
      getRemindableAppointments("salon-1", {
        startDate: "2026-05-29T05:00:00.000Z",
        endDate: "2026-06-06T04:59:59.999Z",
      })
    ).resolves.toEqual([appointment("scheduled"), appointment("confirmed")]);
  });
});
