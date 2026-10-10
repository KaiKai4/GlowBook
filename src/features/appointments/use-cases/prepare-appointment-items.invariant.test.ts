import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import { APPOINTMENT_MESSAGES } from "../domain/messages";
import { prepareAppointmentItems } from "./prepare-appointment-items";
import { createAppointmentCommandFakes, prepareDepsFrom } from "@/test/appointment-command-fakes";

// buildItemPayloads no puede devolver una lista vacia con asignaciones validas:
// este test fuerza ese caso para comprobar la guarda de invariante (ADR 0029).
vi.mock("../domain/scheduling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domain/scheduling")>()),
  buildItemPayloads: vi.fn(() => []),
}));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const fakes = createAppointmentCommandFakes();
const salonId = "00000000-0000-0000-0000-000000000001";
const serviceId = "00000000-0000-0000-0000-000000000004";
const employeeId = "00000000-0000-0000-0000-000000000005";
const FALLBACK = APPOINTMENT_MESSAGES.createFailed;

const openAllWeek = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  is_open: true,
  open_time: "00:00",
  close_time: "23:59",
}));

describe("prepareAppointmentItems: invariante de items vacios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.findAppointmentCreationResources.mockResolvedValue({
      customerExists: false,
      salonConfig: {
        min_booking_notice_minutes: 0,
        min_appointment_duration_minutes: 30,
        allow_off_hours_bookings: false,
        timezone: "UTC",
      },
      businessHours: openAllWeek,
      assignments: [
        {
          service: {
            id: serviceId,
            duration_minutes: 30,
            price: 25,
            salon_id: salonId,
            is_active: true,
            category_id: "category-1",
          },
          employee: {
            id: employeeId,
            salon_id: salonId,
            is_active: true,
            profile_id: null,
            service_ids: [serviceId],
            category_ids: ["category-1"],
          },
        },
      ],
    });
    fakes.findWorkSchedulesByEmployeeForCommand.mockResolvedValue(new Map());
    fakes.findExceptionDatesByEmployeeForCommand.mockResolvedValue(new Map());
    fakes.findOccupiedSlotsByEmployeeForCommand.mockResolvedValue(new Map());
  });

  it("devuelve el mensaje fijo y registra la invariante sin lanzar", async () => {
    const result = await prepareAppointmentItems(
      {
        salonId,
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
        startTime: "2030-01-01T10:00:00.000Z",
        action: "create",
      },
      prepareDepsFrom(fakes)
    );

    expect(result).toEqual({ ok: false, error: FALLBACK });
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), {
      module: "appointments",
      action: "create",
    });
  });
});
