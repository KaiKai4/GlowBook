import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findAppointmentCreationResources,
  findOccupiedSlotsByEmployeeForCommand,
  findExceptionDatesByEmployeeForCommand,
  findWorkSchedulesByEmployeeForCommand,
} from "../data/appointment-commands.repo";
import { createAppointmentWithRpc } from "../data/rpc/create-appointment";
import { createAppointment } from "./create-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentCreationResources: vi.fn(),
  findOccupiedSlotsByEmployeeForCommand: vi.fn(),
  findExceptionDatesByEmployeeForCommand: vi.fn(),
  findWorkSchedulesByEmployeeForCommand: vi.fn(),
}));
vi.mock("../data/rpc/create-appointment", () => ({
  createAppointmentWithRpc: vi.fn(),
}));

const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";

const mockedFindAppointmentCreationResources = vi.mocked(findAppointmentCreationResources);
const mockedFindEmployeeWorkSchedulesForCommand = vi.mocked(findWorkSchedulesByEmployeeForCommand);
const mockedFindEmployeeExceptionDatesForCommand = vi.mocked(findExceptionDatesByEmployeeForCommand);
const mockedFindEmployeeOccupiedSlotsForCommand = vi.mocked(findOccupiedSlotsByEmployeeForCommand);
const mockedCreateAppointmentWithRpc = vi.mocked(createAppointmentWithRpc);

const salonId = "00000000-0000-0000-0000-000000000001";
const userId = "00000000-0000-0000-0000-000000000002";
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

function mockValidResources() {
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
  mockedFindEmployeeWorkSchedulesForCommand.mockResolvedValue(new Map([[employeeId, workAllWeek]]));
  mockedFindEmployeeExceptionDatesForCommand.mockResolvedValue(new Map());
  mockedFindEmployeeOccupiedSlotsForCommand.mockResolvedValue(new Map());
  mockedCreateAppointmentWithRpc.mockResolvedValue({
    ok: true,
    appointmentId: "appointment-1",
  });
}

describe("create appointment command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockValidResources();
  });

  it("builds a validated RPC payload through the command adapter", async () => {
    const result = await createAppointment(
      {
        customer_id: customerId,
        start_time: startTime,
        notes: "Primera visita",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
        idempotency_key: idempotencyKey,
      },
      { salonId, userId, idempotencyKey }
    );

    expect(result).toEqual({ ok: true, value: "appointment-1" });
    expect(mockedFindAppointmentCreationResources).toHaveBeenCalledWith({
      salonId,
      customerId,
      assignments: [{ service_id: serviceId, employee_id: employeeId }],
    });
    expect(mockedCreateAppointmentWithRpc).toHaveBeenCalledWith({
      idempotencyKey,
      payload: {
      salon_id: salonId,
      customer_id: customerId,
      created_by: userId,
      notes: "Primera visita",
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
      },
    });
  });

  it("stops before scheduling when the customer does not belong to the salon", async () => {
    mockedFindAppointmentCreationResources.mockResolvedValue({
      customerExists: false,
      salonConfig: null,
      businessHours: [],
      assignments: [],
    });

    const result = await createAppointment(
      {
        customer_id: customerId,
        start_time: startTime,
        notes: "",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
        idempotency_key: idempotencyKey,
      },
      { salonId, userId, idempotencyKey }
    );

    expect(result).toEqual({
      ok: false,
      error: "Cliente no encontrado en este salón.",
    });
    expect(mockedCreateAppointmentWithRpc).not.toHaveBeenCalled();
  });

  it("maps RPC overlap errors to the user-facing scheduling message", async () => {
    mockedCreateAppointmentWithRpc.mockResolvedValue({
      ok: false,
      reason: "slot_taken",
    });

    const result = await createAppointment(
      {
        customer_id: customerId,
        start_time: startTime,
        notes: "",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
        idempotency_key: idempotencyKey,
      },
      { salonId, userId, idempotencyKey }
    );

    expect(result).toEqual({
      ok: false,
      error: "El profesional ya tiene una cita en ese horario. Elige otro horario.",
    });
  });

  it("devuelve el aviso de cliente inactivo cuando la causa es inactive_customer", async () => {
    mockedCreateAppointmentWithRpc.mockResolvedValue({ ok: false, reason: "inactive_customer" });

    const result = await createAppointment(
      {
        customer_id: customerId,
        start_time: startTime,
        notes: "",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
        idempotency_key: idempotencyKey,
      },
      { salonId, userId, idempotencyKey }
    );

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toContain("no esta disponible para nuevas citas");
  });

  it("decide solo por la causa: un texto de solape sin causa tipada devuelve el error genérico", async () => {
    mockedCreateAppointmentWithRpc.mockResolvedValue({
      ok: false,
      errorMessage: "violates no_overlap_per_employee",
      reason: "unknown",
    });

    const result = await createAppointment(
      {
        customer_id: customerId,
        start_time: startTime,
        notes: "",
        assignments: [{ service_id: serviceId, employee_id: employeeId }],
        idempotency_key: idempotencyKey,
      },
      { salonId, userId, idempotencyKey }
    );

    expect(result.ok === false && result.error).not.toContain("ya tiene una cita");
    expect(result.ok).toBe(false);
  });
});
