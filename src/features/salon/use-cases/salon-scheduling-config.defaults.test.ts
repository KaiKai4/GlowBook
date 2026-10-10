import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAppointmentSalonConfig } from "../data/salon-settings.repo";
import { findBusinessHours } from "../data/salon-business-hours.repo";
import { getSalonSchedulingConfig } from "./salon-scheduling-config";

vi.mock("../data/salon-settings.repo", () => ({
  findAppointmentSalonConfig: vi.fn(),
}));

vi.mock("../data/salon-business-hours.repo", () => ({
  findBusinessHours: vi.fn(),
}));

const mockedFindConfig = vi.mocked(findAppointmentSalonConfig);
const mockedFindHours = vi.mocked(findBusinessHours);

describe("getSalonSchedulingConfig (valores por defecto)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aplica los valores por defecto cuando el salón no tiene configuración de agenda", async () => {
    mockedFindConfig.mockResolvedValue(null);
    mockedFindHours.mockResolvedValue([]);

    const config = await getSalonSchedulingConfig("salon-1");

    expect(config).toEqual({
      salonConfig: {
        min_booking_notice_minutes: 0,
        min_appointment_duration_minutes: 30,
        allow_off_hours_bookings: false,
        timezone: "America/Panama",
      },
      businessHours: [],
    });
  });

  it("respeta valores explicitos, incluido un aviso mínimo de cero y citas fuera de horario", async () => {
    mockedFindConfig.mockResolvedValue({
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 45,
      allow_off_hours_bookings: true,
      timezone: "Europe/Madrid",
    });
    mockedFindHours.mockResolvedValue([
      { day_of_week: 6, is_open: false, open_time: null, close_time: null },
    ]);

    const config = await getSalonSchedulingConfig("salon-1");

    expect(config.salonConfig).toEqual({
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 45,
      allow_off_hours_bookings: true,
      timezone: "Europe/Madrid",
    });
    expect(config.businessHours).toEqual([
      { day_of_week: 6, is_open: false, open_time: null, close_time: null },
    ]);
  });

  it("consulta la configuración y los horarios del mismo salón", async () => {
    mockedFindConfig.mockResolvedValue(null);
    mockedFindHours.mockResolvedValue([]);

    await getSalonSchedulingConfig("salon-42");

    expect(mockedFindConfig).toHaveBeenCalledWith("salon-42");
    expect(mockedFindHours).toHaveBeenCalledWith("salon-42");
  });
});
