import { beforeEach, describe, expect, it } from "vitest";
import { fakeCancelAppointmentDeps, fakeCompleteAppointmentDeps, fakeConfirmAppointmentDeps } from "@/test/appointment-command-fakes";
import { cancelAppointment } from "./cancel-appointment";
import { completeAppointment } from "./complete-appointment";
import { confirmAppointment } from "./confirm-appointment";

// Comandos de transición de cita (ADR 0028): cada colaborador entra como fake tipado
// por parámetro. Ningún test toca data/ ni las RPC reales.

const appointmentId = "appointment-1";
const salonId = "salon-1";
const idempotencyKey = "00000000-0000-4000-8000-0000000000d1";

let confirmDeps: ReturnType<typeof fakeConfirmAppointmentDeps>;
let cancelDeps: ReturnType<typeof fakeCancelAppointmentDeps>;
let completeDeps: ReturnType<typeof fakeCompleteAppointmentDeps>;

const scheduledAppointment = {
  id: appointmentId,
  salon_id: salonId,
  status: "scheduled" as const,
  customer_id: "customer-1",
};

beforeEach(() => {
  confirmDeps = fakeConfirmAppointmentDeps();
  cancelDeps = fakeCancelAppointmentDeps();
  completeDeps = fakeCompleteAppointmentDeps();
  confirmDeps.findAppointment.mockResolvedValue(scheduledAppointment);
  cancelDeps.findAppointment.mockResolvedValue(scheduledAppointment);
  completeDeps.findAppointment.mockResolvedValue(scheduledAppointment);
});

describe("appointment lifecycle commands", () => {
  it("confirms a scheduled appointment through the transactional RPC", async () => {
    const result = await confirmAppointment(appointmentId, salonId, idempotencyKey, confirmDeps);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(confirmDeps.confirmRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("cancels through a single RPC that also releases the calendar", async () => {
    const result = await cancelAppointment(
      { appointmentId, salonId, idempotencyKey, customerDisposition: "keep" },
      cancelDeps
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(cancelDeps.cancelRpc).toHaveBeenCalledTimes(1);
    expect(cancelDeps.cancelRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("completes through one RPC with item charges, note and idempotency key", async () => {
    const result = await completeAppointment(
      {
        appointmentId,
        salonId,
        paymentMethod: "cash",
        itemCharges: [
          { id: "item-fixed", price: 20, discountPercentage: 20 },
          { id: "item-variable", price: 40, discountPercentage: 0 },
        ],
        completionPriceNote: "  Diseno adicional  ",
        idempotencyKey,
      },
      completeDeps
    );

    expect(result).toEqual({ ok: true, value: expect.objectContaining({ status: "completed", total_price: 56 }) });
    expect(completeDeps.completeRpc).toHaveBeenCalledWith({
      appointmentId,
      paymentMethod: "cash",
      completionPriceNote: "Diseno adicional",
      itemCharges: [
        { id: "item-fixed", price: 20, discountPercentage: 20 },
        { id: "item-variable", price: 40, discountPercentage: 0 },
      ],
      idempotencyKey,
    });
  });

  it("maps the database's domain rejection of fixed-price changes to the public message", async () => {
    completeDeps.completeRpc.mockRejectedValue({
      code: "P0001",
      message: "Solo puedes cambiar el precio de servicios con precio variable.",
    });

    const result = await completeAppointment(
      { appointmentId, salonId, paymentMethod: "cash", itemCharges: [{ id: "item-fixed", price: 25 }], idempotencyKey },
      completeDeps
    );

    expect(result).toEqual({
      ok: false,
      error: "Solo puedes cambiar el precio de servicios con precio variable.",
    });
  });

  it("does not call the RPC when the lifecycle transition is invalid", async () => {
    completeDeps.findAppointment.mockResolvedValue({ ...scheduledAppointment, status: "cancelled" });

    const result = await completeAppointment({ appointmentId, salonId, paymentMethod: "cash", idempotencyKey }, completeDeps);

    expect(result.ok).toBe(false);
    expect(completeDeps.completeRpc).not.toHaveBeenCalled();
  });
});
