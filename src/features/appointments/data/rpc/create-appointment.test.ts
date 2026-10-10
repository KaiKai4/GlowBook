import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAppointmentsSupabaseDouble,
  installSupabaseDouble,
} from "@/test/appointments-feature-supabase";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { APPOINTMENT_MESSAGES } from "../../domain/messages";
import { createAppointmentWithRpc, type CreateAppointmentRpcPayload } from "./create-appointment";

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createSupabaseServerClient);

const SALON_ID = "00000000-0000-4000-8000-0000000000e1";
const CUSTOMER_ID = "00000000-0000-4000-8000-0000000000d3";
const EMPLOYEE_ID = "00000000-0000-4000-8000-0000000000d7";
const SERVICE_ID = "00000000-0000-4000-8000-0000000000d5";
const APPOINTMENT_ID = "00000000-0000-4000-8000-0000000000a9";
const KEY = "00000000-0000-4000-8000-0000000000c1";
const failure = { message: 'no_overlap_per_employee: el profesional ya tiene una cita' };

const payload: CreateAppointmentRpcPayload = {
  salon_id: SALON_ID,
  customer_id: CUSTOMER_ID,
  created_by: EMPLOYEE_ID,
  notes: "",
  items: [
    {
      salon_id: SALON_ID,
      service_id: SERVICE_ID,
      employee_id: EMPLOYEE_ID,
      start_time: "2026-05-25T15:00:00.000Z",
      end_time: "2026-05-25T15:30:00.000Z",
      duration_minutes: 30,
      price: 25,
      ordering: 1,
      blocks_calendar: true,
    },
  ],
};

describe("createAppointmentWithRpc", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("envia el payload canonico con la clave de idempotencia y devuelve el id de la cita", async () => {
    const double = createAppointmentsSupabaseDouble({}, { data: APPOINTMENT_ID, error: null });
    installSupabaseDouble(double, mockedCreateClient);

    expect(await createAppointmentWithRpc({ payload, idempotencyKey: KEY })).toEqual({
      ok: true,
      appointmentId: APPOINTMENT_ID,
    });
    expect(double.rpc).toHaveBeenCalledWith("create_appointment", {
      payload: { ...payload, idempotency_key: KEY },
    });
  });

  it("reenviar la misma clave produce el mismo payload", async () => {
    const double = createAppointmentsSupabaseDouble({}, { data: APPOINTMENT_ID, error: null });
    installSupabaseDouble(double, mockedCreateClient);

    await createAppointmentWithRpc({ payload, idempotencyKey: KEY });
    await createAppointmentWithRpc({ payload, idempotencyKey: KEY });

    expect(double.rpc.mock.calls[0]).toEqual(double.rpc.mock.calls[1]);
  });

  it("devuelve ok false con causa slot_taken cuando el profesional se solapa", async () => {
    installSupabaseDouble(createAppointmentsSupabaseDouble({}, { data: null, error: failure }), mockedCreateClient);

    const result = await createAppointmentWithRpc({ payload, idempotencyKey: KEY });

    expect(result).toEqual({ ok: false, reason: "slot_taken", errorMessage: APPOINTMENT_MESSAGES.createFailed });
  });

  it("devuelve causa inactive_customer cuando el cliente no puede recibir citas", async () => {
    const inactive = {
      message:
        "Este cliente no esta disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.",
    };
    installSupabaseDouble(createAppointmentsSupabaseDouble({}, { data: null, error: inactive }), mockedCreateClient);

    const result = await createAppointmentWithRpc({ payload, idempotencyKey: KEY });

    expect(result).toMatchObject({ ok: false, reason: "inactive_customer" });
  });

  it("devuelve ok false si la base responde algo que no es un uuid", async () => {
    installSupabaseDouble(createAppointmentsSupabaseDouble({}, { data: 42, error: null }), mockedCreateClient);

    const result = await createAppointmentWithRpc({ payload, idempotencyKey: KEY });

    expect(result.ok).toBe(false);
    expect(result.appointmentId).toBeUndefined();
  });
});
