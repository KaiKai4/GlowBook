import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findAppointmentCreationResources,
  findExceptionDatesByEmployeeForCommand,
  findOccupiedSlotsByEmployeeForCommand,
  findWorkSchedulesByEmployeeForCommand,
} from "../data/appointment-commands.repo";
import { prepareAppointmentItems } from "./prepare-appointment-items";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentCreationResources: vi.fn(),
  findOccupiedSlotsByEmployeeForCommand: vi.fn(),
  findExceptionDatesByEmployeeForCommand: vi.fn(),
  findWorkSchedulesByEmployeeForCommand: vi.fn(),
}));
vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const mockedResources = vi.mocked(findAppointmentCreationResources);
const mockedSchedules = vi.mocked(findWorkSchedulesByEmployeeForCommand);
const mockedExceptions = vi.mocked(findExceptionDatesByEmployeeForCommand);
const mockedOccupied = vi.mocked(findOccupiedSlotsByEmployeeForCommand);

const salonId = "00000000-0000-0000-0000-000000000001";
const customerId = "00000000-0000-0000-0000-000000000003";
const serviceId = "00000000-0000-0000-0000-000000000004";
const employeeId = "00000000-0000-0000-0000-000000000005";
const startTime = "2030-01-01T10:00:00.000Z";

const openAllWeek = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  is_open: true,
  open_time: "00:00",
  close_time: "23:59",
}));

const workAllWeek = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  start_time: "00:00",
  end_time: "23:59",
  is_active: true,
}));

/** Recursos válidos: un servicio de 30 minutos atendido por un profesional. */
function validResources(customerExists: boolean) {
  return {
    customerExists,
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
  };
}

const baseInput = {
  salonId,
  assignments: [{ service_id: serviceId, employee_id: employeeId }],
  startTime,
  action: "create" as const,
};

describe("prepareAppointmentItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSchedules.mockResolvedValue(new Map([[employeeId, workAllWeek]]));
    mockedExceptions.mockResolvedValue(new Map());
    mockedOccupied.mockResolvedValue(new Map());
  });

  it("cliente nuevo (sin customerId) con recursos válidos construye los items", async () => {
    mockedResources.mockResolvedValue(validResources(false));

    const result = await prepareAppointmentItems(baseInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.startTime).toEqual(new Date(startTime));
    expect(result.value.items).toEqual([
      {
        salon_id: salonId,
        service_id: serviceId,
        employee_id: employeeId,
        start_time: startTime,
        end_time: "2030-01-01T10:30:00.000Z",
        duration_minutes: 30,
        price: 25,
        ordering: 1,
        blocks_calendar: true,
      },
    ]);
    expect(mockedResources).toHaveBeenCalledWith(expect.objectContaining({ customerId: undefined }));
  });

  it("consulta horarios, excepciones y ocupación en lote para todos los profesionales", async () => {
    mockedResources.mockResolvedValue(validResources(true));

    await prepareAppointmentItems({ ...baseInput, customerId, excludeAppointmentId: "appt-1" });

    expect(mockedSchedules).toHaveBeenCalledTimes(1);
    expect(mockedSchedules).toHaveBeenCalledWith({ salonId, employeeIds: [employeeId] });
    expect(mockedExceptions).toHaveBeenCalledTimes(1);
    expect(mockedOccupied).toHaveBeenCalledWith(
      expect.objectContaining({ salonId, employeeIds: [employeeId], timezone: "UTC", excludeAppointmentId: "appt-1" })
    );
  });

  it("cliente pedido que no existe devuelve el mensaje de cliente no encontrado", async () => {
    mockedResources.mockResolvedValue(validResources(false));

    const result = await prepareAppointmentItems({ ...baseInput, customerId });

    expect(result).toEqual({ ok: false, error: "Cliente no encontrado en este salón." });
    expect(mockedSchedules).not.toHaveBeenCalled();
  });

  it("sin salón devuelve el mensaje de salón no encontrado", async () => {
    mockedResources.mockResolvedValue({ ...validResources(true), salonConfig: null });

    const result = await prepareAppointmentItems(baseInput);

    expect(result.ok).toBe(false);
    expect(mockedSchedules).not.toHaveBeenCalled();
  });

  it("si la carga de horarios falla devuelve error de disponibilidad", async () => {
    mockedResources.mockResolvedValue(validResources(false));
    mockedSchedules.mockRejectedValue(new Error("boom"));

    const result = await prepareAppointmentItems(baseInput);

    expect(result.ok).toBe(false);
  });
});
