import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAppointmentsSupabaseDouble,
  installSupabaseDouble,
} from "@/test/appointments-feature-supabase";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { APPOINTMENT_MESSAGES } from "../../domain/messages";
import { updateAppointmentWithRpc } from "./update-appointment";

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createSupabaseServerClient);

const APPOINTMENT_ID = "00000000-0000-4000-8000-0000000000a9";
const KEY = "00000000-0000-4000-8000-0000000000c1";
const failure = { message: "no_overlap_per_employee: el profesional ya tiene una cita" };

const items = [
  {
    salon_id: "00000000-0000-4000-8000-0000000000e1",
    service_id: "00000000-0000-4000-8000-0000000000d5",
    employee_id: "00000000-0000-4000-8000-0000000000d7",
    start_time: "2026-05-25T15:00:00.000Z",
    end_time: "2026-05-25T15:30:00.000Z",
    duration_minutes: 30,
    price: 25,
    ordering: 1,
    blocks_calendar: true,
  },
];

describe("updateAppointmentWithRpc", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("envia el payload canonico con la clave de idempotencia", async () => {
    const double = createAppointmentsSupabaseDouble({}, { data: null, error: null });
    installSupabaseDouble(double, mockedCreateClient);

    expect(
      await updateAppointmentWithRpc({
        payload: { appointment_id: APPOINTMENT_ID, notes: "Nueva nota", items },
        idempotencyKey: KEY,
      })
    ).toEqual({ ok: true });
    expect(double.rpc).toHaveBeenCalledWith("update_appointment", {
      payload: { appointment_id: APPOINTMENT_ID, notes: "Nueva nota", items, idempotency_key: KEY },
    });
  });

  it("devuelve ok false con un mensaje público cuando el profesional se solapa", async () => {
    installSupabaseDouble(createAppointmentsSupabaseDouble({}, { data: null, error: failure }), mockedCreateClient);

    const result = await updateAppointmentWithRpc({
      payload: { appointment_id: APPOINTMENT_ID, notes: "", items: [] },
      idempotencyKey: KEY,
    });

    expect(result).toEqual({ ok: false, reason: "slot_taken", errorMessage: APPOINTMENT_MESSAGES.updateFailed });
  });
});
