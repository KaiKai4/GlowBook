import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureError } from "@/infra/observability";
import type { AppointmentCreationResources } from "../data/appointment-commands.repo";
import type { CreateAppointmentInput } from "../schemas";
import { createAppointment } from "./create-appointment";
import { createAppointmentCommandFakes, createDepsFrom } from "@/test/appointment-command-fakes";

const fakes = createAppointmentCommandFakes();
const runCreate: typeof createAppointment = (input, ctx) => createAppointment(input, ctx, createDepsFrom(fakes));

vi.mock("@/infra/observability", () => ({ captureError: vi.fn() }));

const salonId = "00000000-0000-4000-8000-0000000000e1";
const userId = "00000000-0000-4000-8000-0000000000e2";
const categoryId = "00000000-0000-4000-8000-0000000000e4";
const serviceId = "00000000-0000-4000-8000-0000000000e5";
const employeeId = "00000000-0000-4000-8000-0000000000e7";
const idempotencyKey = "00000000-0000-4000-8000-0000000000c1";
const deps = { salonId, userId, idempotencyKey };

// 2030-01-01 es martes. 09:00 en Panamá son las 14:00 UTC.
const startIso = "2030-01-01T14:00:00.000Z";

const mockedResources = fakes.findAppointmentCreationResources;
const mockedRpc = fakes.createAppointmentWithRpc;
const mockedSchedules = fakes.findWorkSchedulesByEmployeeForCommand;
const mockedExceptions = fakes.findExceptionDatesByEmployeeForCommand;
const mockedOccupied = fakes.findOccupiedSlotsByEmployeeForCommand;
const mockedCaptureError = vi.mocked(captureError);

const validAssignment: AppointmentCreationResources["assignments"][number] = {
  service: {
    id: serviceId,
    duration_minutes: 30,
    price: 25,
    salon_id: salonId,
    is_active: true,
    category_id: categoryId,
  },
  employee: {
    id: employeeId,
    salon_id: salonId,
    is_active: true,
    profile_id: null,
    service_ids: [serviceId],
    category_ids: [categoryId],
  },
};

/** Recursos de un cliente nuevo: todavía no existe, la RPC lo da de alta. */
function newCustomerResources(): AppointmentCreationResources {
  return {
    customerExists: false,
    salonConfig: {
      timezone: "America/Panama",
      allow_off_hours_bookings: false,
      min_booking_notice_minutes: 0,
      min_appointment_duration_minutes: 15,
    },
    businessHours: [{ day_of_week: 1, is_open: true, open_time: "08:00", close_time: "18:00" }],
    assignments: [validAssignment],
  };
}

function newCustomerInput(
  customer: { first_name: string; last_name: string; phone?: string }
): CreateAppointmentInput {
  return {
    new_customer: customer,
    start_time: startIso,
    notes: "",
    assignments: [{ service_id: serviceId, employee_id: employeeId }],
    idempotency_key: idempotencyKey,
  } as CreateAppointmentInput;
}

describe("createAppointment: cliente nuevo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedResources.mockResolvedValue(newCustomerResources());
    // Los repos de disponibilidad devuelven mapas por profesional (carga en lote).
    mockedSchedules.mockResolvedValue(
      new Map([
        [
          employeeId,
          [{ day_of_week: 1, is_active: true, start_time: "08:00", end_time: "18:00" }],
        ],
      ])
    );
    mockedExceptions.mockResolvedValue(new Map());
    mockedOccupied.mockResolvedValue(new Map());
    mockedRpc.mockResolvedValue({ ok: true, appointmentId: "appointment-new" });
  });

  it("envía new_customer al RPC en lugar de customer_id, sin el teléfono vacío", async () => {
    const result = await runCreate(
      newCustomerInput({ first_name: "Luis", last_name: "Soto", phone: "   " }),
      deps
    );

    expect(result).toEqual({ ok: true, value: "appointment-new" });
    const payload = mockedRpc.mock.calls[0]?.[0].payload;
    expect(payload).toMatchObject({
      salon_id: salonId,
      created_by: userId,
      new_customer: { first_name: "Luis", last_name: "Soto" },
    });
    expect(payload).not.toHaveProperty("customer_id");
    expect(payload?.new_customer).not.toHaveProperty("phone");
  });

  it("conserva el teléfono del cliente nuevo sin espacios sobrantes", async () => {
    await runCreate(
      newCustomerInput({ first_name: "Luis", last_name: "Soto", phone: "  +50761112233 " }),
      deps
    );

    expect(mockedRpc.mock.calls[0]?.[0].payload.new_customer).toEqual({
      first_name: "Luis",
      last_name: "Soto",
      phone: "+50761112233",
    });
  });

  it("no rechaza el cliente nuevo por no existir todavía", async () => {
    const result = await runCreate(
      newCustomerInput({ first_name: "Luis", last_name: "Soto" }),
      deps
    );

    expect(result.ok).toBe(true);
    expect(mockedRpc).toHaveBeenCalledTimes(1);
  });

  it("traduce el rechazo de cliente inactivo al mensaje de restauración", async () => {
    // El adaptador clasifica el fallo por causa tipada, no por el texto del mensaje.
    mockedRpc.mockResolvedValue({
      ok: false,
      reason: "inactive_customer",
      errorMessage:
        "Este cliente no está disponible para nuevas citas. Restáuralo desde Clientes para conservar su historial.",
    });

    expect(await runCreate(newCustomerInput({ first_name: "Luis", last_name: "Soto" }), deps)).toEqual({
      ok: false,
      error:
        "Este cliente no está disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.",
    });
  });

  it("devuelve datos inválidos y registra el fallo si la carga de recursos lanza", async () => {
    const failure = new Error("resources query failed");
    mockedResources.mockRejectedValue(failure);

    expect(await runCreate(newCustomerInput({ first_name: "Luis", last_name: "Soto" }), deps)).toEqual({
      ok: false,
      error: "Datos inválidos.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("si la carga de agenda del profesional falla devuelve error de disponibilidad", async () => {
    const failure = new Error("schedule query failed");
    mockedSchedules.mockRejectedValue(failure);

    expect(await runCreate(newCustomerInput({ first_name: "Luis", last_name: "Soto" }), deps)).toEqual({
      ok: false,
      error: "No se pudo validar la disponibilidad del profesional.",
    });
    expect(mockedCaptureError).toHaveBeenCalledWith(failure, { module: "appointments", action: "create" });
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});

describe("createAppointment: cliente existente no encontrado", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rechaza un customer_id que no existe en el salón sin llamar al RPC", async () => {
    mockedResources.mockResolvedValue({ ...newCustomerResources(), customerExists: false });

    expect(
      await runCreate(
        {
          customer_id: "00000000-0000-4000-8000-0000000000e3",
          start_time: startIso,
          notes: "",
          assignments: [{ service_id: serviceId, employee_id: employeeId }],
          idempotency_key: idempotencyKey,
        } as CreateAppointmentInput,
        deps
      )
    ).toEqual({ ok: false, error: "Cliente no encontrado en este salón." });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("rechaza si el salón no tiene configuración", async () => {
    mockedResources.mockResolvedValue({ ...newCustomerResources(), salonConfig: null });

    expect(await runCreate(newCustomerInput({ first_name: "Luis", last_name: "Soto" }), deps)).toEqual({
      ok: false,
      error: "Salón no encontrado.",
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});
