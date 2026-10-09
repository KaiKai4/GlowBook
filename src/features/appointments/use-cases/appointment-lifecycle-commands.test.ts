import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import { cancelAppointmentRpc } from "../data/rpc/cancel-appointment";
import { completeAppointmentRpc } from "../data/rpc/complete-appointment";
import { confirmAppointmentRpc } from "../data/rpc/confirm-appointment";
import { cancelAppointment } from "./cancel-appointment";
import { completeAppointment } from "./complete-appointment";
import { confirmAppointment } from "./confirm-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
}));

vi.mock("../data/rpc/confirm-appointment", () => ({
  confirmAppointmentRpc: vi.fn(),
}));

vi.mock("../data/rpc/cancel-appointment", () => ({
  cancelAppointmentRpc: vi.fn(),
}));

vi.mock("../data/rpc/complete-appointment", () => ({
  completeAppointmentRpc: vi.fn(),
}));

const mockedFind = vi.mocked(findAppointmentForCommand);
const mockedConfirmRpc = vi.mocked(confirmAppointmentRpc);
const mockedCancelRpc = vi.mocked(cancelAppointmentRpc);
const mockedCompleteRpc = vi.mocked(completeAppointmentRpc);

const appointmentId = "appointment-1";
const salonId = "salon-1";
const idempotencyKey = "00000000-0000-4000-8000-0000000000d1";

const SUMMARY = {
  appointment_id: appointmentId,
  status: "completed" as const,
  subtotal: 56,
  discount_amount: 4,
  total_price: 56,
};

describe("appointment lifecycle commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFind.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "scheduled",
      customer_id: "customer-1",
    });
    mockedConfirmRpc.mockResolvedValue({ appointment_id: appointmentId, status: "confirmed" });
    mockedCancelRpc.mockResolvedValue({ appointment_id: appointmentId, status: "cancelled" });
    mockedCompleteRpc.mockResolvedValue(SUMMARY);
  });

  it("confirms a scheduled appointment through the transactional RPC", async () => {
    const result = await confirmAppointment(appointmentId, salonId, idempotencyKey);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedConfirmRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("cancels through a single RPC that also releases the calendar", async () => {
    const result = await cancelAppointment(appointmentId, salonId, idempotencyKey);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedCancelRpc).toHaveBeenCalledTimes(1);
    expect(mockedCancelRpc).toHaveBeenCalledWith({ appointmentId, idempotencyKey });
  });

  it("completes through one RPC with item charges, note and idempotency key", async () => {
    const result = await completeAppointment(
      appointmentId,
      salonId,
      "cash",
      [
        { id: "item-fixed", price: 20, discountPercentage: 20 },
        { id: "item-variable", price: 40, discountPercentage: 0 },
      ],
      "  Diseno adicional  ",
      idempotencyKey
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedCompleteRpc).toHaveBeenCalledWith({
      appointmentId,
      paymentMethod: "cash",
      completionPriceNote: "Diseno adicional",
      itemCharges: [
        { id: "item-fixed", price: 20, discount_percentage: 20 },
        { id: "item-variable", price: 40, discount_percentage: 0 },
      ],
      idempotencyKey,
    });
  });

  it("maps the database's domain rejection of fixed-price changes to the public message", async () => {
    mockedCompleteRpc.mockRejectedValue({
      code: "P0001",
      message: "Solo puedes cambiar el precio de servicios con precio variable.",
    });

    const result = await completeAppointment(appointmentId, salonId, "cash", [
      { id: "item-fixed", price: 25 },
    ]);

    expect(result).toEqual({
      ok: false,
      error: "Solo puedes cambiar el precio de servicios con precio variable.",
    });
  });

  it("does not call the RPC when the lifecycle transition is invalid", async () => {
    mockedFind.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "cancelled",
      customer_id: "customer-1",
    });

    const result = await completeAppointment(appointmentId, salonId, "cash");

    expect(result.ok).toBe(false);
    expect(mockedCompleteRpc).not.toHaveBeenCalled();
    expect(mockedCancelRpc).not.toHaveBeenCalled();
  });
});
