import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findAppointmentCreationResources,
  findAppointmentForCommand,
  findEmployeeOccupiedSlotsForCommand,
  findEmployeeWorkSchedulesForCommand,
  updateAppointmentWithRpc,
} from "../data/appointment-commands.repo";
import { updateAppointmentSchedule } from "./update-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentCreationResources: vi.fn(),
  findAppointmentForCommand: vi.fn(),
  findEmployeeOccupiedSlotsForCommand: vi.fn(),
  findEmployeeWorkSchedulesForCommand: vi.fn(),
  updateAppointmentWithRpc: vi.fn(),
}));

const mockedFindAppointmentForCommand = vi.mocked(findAppointmentForCommand);
const mockedFindAppointmentCreationResources = vi.mocked(findAppointmentCreationResources);
const mockedFindEmployeeWorkSchedulesForCommand = vi.mocked(findEmployeeWorkSchedulesForCommand);
const mockedFindEmployeeOccupiedSlotsForCommand = vi.mocked(findEmployeeOccupiedSlotsForCommand);
const mockedUpdateAppointmentWithRpc = vi.mocked(updateAppointmentWithRpc);

const appointmentId = "00000000-0000-0000-0000-000000000001";
const salonId = "00000000-0000-0000-0000-000000000002";
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

function mockValidUpdate() {
  mockedFindAppointmentForCommand.mockResolvedValue({
    id: appointmentId,
    salon_id: salonId,
    status: "scheduled",
    customer_id: customerId,
  });
  mockedFindAppointmentCreationResources.mockResolvedValue({
    customerExists: true,
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
  mockedFindEmployeeWorkSchedulesForCommand.mockResolvedValue(workAllWeek);
  mockedFindEmployeeOccupiedSlotsForCommand.mockResolvedValue([]);
  mockedUpdateAppointmentWithRpc.mockResolvedValue({ ok: true });
}

describe("update appointment schedule", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockValidUpdate();
  });

  it("rebuilds appointment items through the transactional update adapter", async () => {
    const result = await updateAppointmentSchedule(
      {
        appointment_id: appointmentId,
        start_time: startTime,
        notes: "Nuevo horario",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
      },
      { salonId }
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedFindAppointmentForCommand).toHaveBeenCalledWith(appointmentId, salonId);
    expect(mockedFindEmployeeOccupiedSlotsForCommand).toHaveBeenCalledWith({
      employeeId,
      date: new Date(startTime),
      timezone: "UTC",
      excludeAppointmentId: appointmentId,
    });
    expect(mockedUpdateAppointmentWithRpc).toHaveBeenCalledWith({
      appointment_id: appointmentId,
      notes: "Nuevo horario",
      items: [
        {
          salon_id: salonId,
          service_id: serviceId,
          employee_id: employeeId,
          start_time: "2030-01-01T10:00:00.000Z",
          end_time: "2030-01-01T10:30:00.000Z",
          duration_minutes: 30,
          price: 25,
          ordering: 1,
          blocks_calendar: true,
        },
      ],
    });
  });

  it("does not edit closed appointments", async () => {
    mockedFindAppointmentForCommand.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "completed",
      customer_id: customerId,
    });

    const result = await updateAppointmentSchedule(
      {
        appointment_id: appointmentId,
        start_time: startTime,
        notes: "",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
      },
      { salonId }
    );

    expect(result.ok).toBe(false);
    expect(mockedUpdateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("maps overlap errors to the scheduling message", async () => {
    mockedUpdateAppointmentWithRpc.mockResolvedValue({
      ok: false,
      errorMessage: "violates no_overlap_per_employee",
    });

    const result = await updateAppointmentSchedule(
      {
        appointment_id: appointmentId,
        start_time: startTime,
        notes: "",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
      },
      { salonId }
    );

    expect(result).toEqual({
      ok: false,
      error: "El profesional ya tiene una cita en ese horario. Elige otro horario.",
    });
  });
});
