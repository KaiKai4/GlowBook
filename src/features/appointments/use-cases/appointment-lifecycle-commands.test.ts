import { beforeEach, describe, expect, it, vi } from "vitest";
import { promoteCustomer } from "@/features/customers/use-cases/customer-temporary";
import {
  applyAppointmentItemDiscount,
  findAppointmentForCommand,
  setAppointmentItemsCalendarBlocking,
  updateAppointmentStatus,
} from "../data/appointment-commands.repo";
import { cancelAppointment } from "./cancel-appointment";
import { completeAppointment } from "./complete-appointment";
import { confirmAppointment } from "./confirm-appointment";

vi.mock("../data/appointment-commands.repo", () => ({
  applyAppointmentItemDiscount: vi.fn(),
  findAppointmentForCommand: vi.fn(),
  setAppointmentItemsCalendarBlocking: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));

vi.mock("@/features/customers/use-cases/customer-temporary", () => ({
  promoteCustomer: vi.fn(),
}));

const mockedApplyAppointmentItemDiscount = vi.mocked(applyAppointmentItemDiscount);
const mockedFindAppointmentForCommand = vi.mocked(findAppointmentForCommand);
const mockedSetAppointmentItemsCalendarBlocking = vi.mocked(setAppointmentItemsCalendarBlocking);
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
    mockedApplyAppointmentItemDiscount.mockResolvedValue(undefined);
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
    expect(
      mockedSetAppointmentItemsCalendarBlocking.mock.invocationCallOrder[0]
    ).toBeLessThan(mockedUpdateAppointmentStatus.mock.invocationCallOrder[0]);
  });

  it("completes, discounts, releases calendar blocks and promotes the customer", async () => {
    const result = await completeAppointment(appointmentId, salonId, "cash", 10);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(mockedApplyAppointmentItemDiscount).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      discountPercentage: 10,
    });
    expect(mockedUpdateAppointmentStatus).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      status: "completed",
      paymentMethod: "cash",
    });
    expect(mockedSetAppointmentItemsCalendarBlocking).toHaveBeenCalledWith({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
    expect(mockedPromoteCustomer).toHaveBeenCalledWith("customer-1", salonId);
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
