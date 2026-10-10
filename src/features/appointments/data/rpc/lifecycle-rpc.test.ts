import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import { cancelAppointmentRpc } from "./cancel-appointment";
import { completeAppointmentRpc } from "./complete-appointment";
import { confirmAppointmentRpc } from "./confirm-appointment";

vi.mock("@/infra/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createSupabaseServerClient);
const rpc = vi.fn();

const APPOINTMENT_ID = "00000000-0000-4000-8000-0000000000a1";
const ITEM_ID = "00000000-0000-4000-8000-0000000000b1";
const KEY = "00000000-0000-4000-8000-0000000000c1";

function useRpcResponse(response: { data: unknown; error: unknown }): void {
  rpc.mockResolvedValue(response);
  mockedCreateClient.mockResolvedValue({ rpc } as never);
}

describe("adaptadores RPC de ciclo de vida de cita", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("confirmar envía el payload canónico con la clave y válida el resultado", async () => {
    useRpcResponse({ data: { appointment_id: APPOINTMENT_ID, status: "confirmed" }, error: null });

    const result = await confirmAppointmentRpc({ appointmentId: APPOINTMENT_ID, idempotencyKey: KEY });

    expect(result).toEqual({ appointment_id: APPOINTMENT_ID, status: "confirmed" });
    expect(rpc).toHaveBeenCalledWith("confirm_appointment", {
      payload: { appointment_id: APPOINTMENT_ID, idempotency_key: KEY },
    });
  });

  it("sin clave omite idempotency_key del payload", async () => {
    useRpcResponse({ data: { appointment_id: APPOINTMENT_ID, status: "confirmed" }, error: null });

    await confirmAppointmentRpc({ appointmentId: APPOINTMENT_ID });

    expect(rpc).toHaveBeenCalledWith("confirm_appointment", {
      payload: { appointment_id: APPOINTMENT_ID },
    });
  });

  it("confirmar rechaza un resultado con estado inesperado", async () => {
    useRpcResponse({ data: { appointment_id: APPOINTMENT_ID, status: "completed" }, error: null });

    await expect(confirmAppointmentRpc({ appointmentId: APPOINTMENT_ID })).rejects.toThrow(
      "Respuesta inesperada de la RPC confirm_appointment."
    );
  });

  it("cancelar propaga el error de la RPC sin transformarlo", async () => {
    const failure = { code: "P0001", message: 'No se puede cambiar el estado de "completed" a "cancelled".' };
    useRpcResponse({ data: null, error: failure });

    await expect(cancelAppointmentRpc({ appointmentId: APPOINTMENT_ID })).rejects.toBe(failure);
  });

  it("cancelar envía la clave y válida el estado devuelto", async () => {
    useRpcResponse({ data: { appointment_id: APPOINTMENT_ID, status: "confirmed" }, error: null });

    await expect(cancelAppointmentRpc({ appointmentId: APPOINTMENT_ID, idempotencyKey: KEY })).rejects.toThrow(
      "Respuesta inesperada de la RPC cancel_appointment."
    );
    expect(rpc).toHaveBeenCalledWith("cancel_appointment", {
      payload: { appointment_id: APPOINTMENT_ID, idempotency_key: KEY },
    });
  });

  it("completar envía cobros canónicos (descuento por defecto 0, nota recortada por el caso de uso)", async () => {
    const summary = {
      appointment_id: APPOINTMENT_ID,
      status: "completed",
      subtotal: 15,
      discount_amount: 0,
      total_price: 15,
    };
    useRpcResponse({ data: summary, error: null });

    const result = await completeAppointmentRpc({
      appointmentId: APPOINTMENT_ID,
      paymentMethod: "cash",
      itemCharges: [{ id: ITEM_ID, price: 15.0 }],
      idempotencyKey: KEY,
    });

    expect(result).toEqual(summary);
    expect(rpc).toHaveBeenCalledWith("complete_appointment", {
      payload: {
        appointment_id: APPOINTMENT_ID,
        payment_method: "cash",
        completion_price_note: "",
        item_charges: [{ id: ITEM_ID, price: 15, discount_percentage: 0 }],
        idempotency_key: KEY,
      },
    });
  });

  it("completar rechaza un resumen con totales no numéricos", async () => {
    useRpcResponse({
      data: { appointment_id: APPOINTMENT_ID, status: "completed", subtotal: "15", discount_amount: 0, total_price: 15 },
      error: null,
    });

    await expect(
      completeAppointmentRpc({ appointmentId: APPOINTMENT_ID, paymentMethod: "cash", itemCharges: [] })
    ).rejects.toThrow("Respuesta inesperada de la RPC complete_appointment.");
  });
});
