import { describe, expect, it, vi } from "vitest";
import { findAppointmentSalonConfig, findBusinessHours } from "../data/salon.repo";
import { getSalonSchedulingConfig } from "./salon-scheduling-config";

vi.mock("../data/salon.repo", () => ({
  findAppointmentSalonConfig: vi.fn(),
  findBusinessHours: vi.fn(),
}));

const mockedFindAppointmentSalonConfig = vi.mocked(findAppointmentSalonConfig);
const mockedFindBusinessHours = vi.mocked(findBusinessHours);

describe("salon scheduling config", () => {
  it("returns scheduling defaults when the salon has no explicit config", async () => {
    mockedFindAppointmentSalonConfig.mockResolvedValue(null);
    mockedFindBusinessHours.mockResolvedValue([]);

    await expect(getSalonSchedulingConfig("salon-1")).resolves.toEqual({
      salonConfig: {
        min_booking_notice_minutes: 0,
        min_appointment_duration_minutes: 30,
        allow_off_hours_bookings: false,
        timezone: "America/Panama",
      },
      businessHours: [],
    });
  });
});
