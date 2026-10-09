import { beforeEach, describe, expect, it, vi } from "vitest";
import { promoteCustomer } from "@/features/customers/use-cases/customer-temporary";
import {
  findAppointmentForCommand,
  findAppointmentItemsForPricing,
  setAppointmentItemsCalendarBlocking,
  updateAppointmentItemCharges,
  updateAppointmentStatus,
} from "../data/appointment-commands.repo";
import { cancelAppointment } from "./cancel-appointment";
import { completeAppointment } from "./complete-appointment";
import { confirmAppointment } from "./confirm-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  findAppointmentForCommand: vi.fn(),
  findAppointmentItemsForPricing: vi.fn(),
  setAppointmentItemsCalendarBlocking: vi.fn(),
  updateAppointmentItemCharges: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));

vi.mock("@/features/customers/use-cases/customer-temporary", () => ({
  promoteCustomer: vi.fn(),
}));

const mockedFindAppointmentForCommand = vi.mocked(findAppointmentForCommand);
const mockedFindAppointmentItemsForPricing = vi.mocked(findAppointmentItemsForPricing);
const mockedSetAppointmentItemsCalendarBlocking = vi.mocked(setAppointmentItemsCalendarBlocking);
const mockedUpdateAppointmentItemCharges = vi.mocked(updateAppointmentItemCharges);
const mockedUpdateAppointmentStatus = vi.mocked(updateAppointmentStatus);
const mockedPromoteCustomer = vi.mocked(promoteCustomer);

const appointmentId = "appointment-1";
const salonId = "salon-1";

describe("appointment lifecycle commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindAppointmentForCommand.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "scheduled",
      customer_id: "customer-1",
    });
    mockedFindAppointmentItemsForPricing.mockResolvedValue([
      { id: "item-fixed", price: 20, discount_amount: 0, pricing_mode: "fixed" },
      { id: "item-variable", price: 30, discount_amount: 0, pricing_mode: "variable" },
    ]);
    mockedUpdateAppointmentItemCharges.mockResolvedValue(undefined);
    mockedSetAppointmentItemsCalendarBlocking.mockResolvedValue(undefined);
    mockedUpdateAppointmentStatus.mockResolvedValue(undefined);
    mockedPromoteCustomer.mockResolvedValue({ ok: true, value: undefined });
  });

  it("confirms a scheduled appointment through the command adapter", async () => {
    const result = await confirmAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedUpdateAppointmentStatus).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      status: "confirmed",
    });
  });

  it("releases calendar blocks before cancelling the appointment", async () => {
    const result = await cancelAppointment(appointmentId, salonId);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedSetAppointmentItemsCalendarBlocking).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
    expect(mockedUpdateAppointmentStatus).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      status: "cancelled",
    });
    const [blockingOrder] = mockedSetAppointmentItemsCalendarBlocking.mock.invocationCallOrder;
    const [statusOrder] = mockedUpdateAppointmentStatus.mock.invocationCallOrder;
    if (blockingOrder === undefined || statusOrder === undefined) {
      throw new Error("Ambas funciones deben haberse llamado.");
    }
    expect(blockingOrder).toBeLessThan(statusOrder);
  });

  it("completes with editable variable prices, item-level discounts, calendar release and customer promotion", async () => {
    const result = await completeAppointment(
      appointmentId,
      salonId,
      "cash",
      [
        { id: "item-fixed", price: 20, discountPercentage: 20 },
        { id: "item-variable", price: 40, discountPercentage: 0 },
      ],
      "Diseno adicional"
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedUpdateAppointmentItemCharges).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      charges: [
        { id: "item-fixed", price: 20, discountAmount: 4 },
        { id: "item-variable", price: 40, discountAmount: 0 },
      ],
    });
    expect(mockedUpdateAppointmentStatus).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      status: "completed",
      paymentMethod: "cash",
      discountAmount: 4,
      totalPrice: 56,
      completionPriceNote: "Diseno adicional",
    });
    expect(mockedSetAppointmentItemsCalendarBlocking).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
    expect(mockedPromoteCustomer).toHaveBeenCalledWith("customer-1", salonId);
  });

  it("blocks manual price changes for fixed-price services", async () => {
    const result = await completeAppointment(appointmentId, salonId, "cash", [
      { id: "item-fixed", price: 25 },
      { id: "item-variable", price: 30 },
    ]);

    expect(result).toEqual({
      ok: false,
      error: "Solo puedes cambiar el precio de servicios con precio variable.",
    });
    expect(mockedUpdateAppointmentItemCharges).not.toHaveBeenCalled();
    expect(mockedUpdateAppointmentStatus).not.toHaveBeenCalled();
  });

  it("does not write when the lifecycle transition is invalid", async () => {
    mockedFindAppointmentForCommand.mockResolvedValue({
      id: appointmentId,
      salon_id: salonId,
      status: "cancelled",
      customer_id: "customer-1",
    });

    const result = await completeAppointment(appointmentId, salonId, "cash");

    expect(result.ok).toBe(false);
    expect(mockedUpdateAppointmentStatus).not.toHaveBeenCalled();
    expect(mockedSetAppointmentItemsCalendarBlocking).not.toHaveBeenCalled();
  });
});
