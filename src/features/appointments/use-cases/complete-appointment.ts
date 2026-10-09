import { toPublicErrorMessage } from "@/lib/errors";
import { promoteCustomer } from "@/features/customers/use-cases/customer-temporary";
import { err, ok, type Result } from "@/lib/result";
import { captureError } from "@/lib/observability";
import {
  findAppointmentForCommand,
  findAppointmentItemsForPricing,
  setAppointmentItemsCalendarBlocking,
  updateAppointmentItemCharges,
  updateAppointmentStatus,
  type AppointmentPaymentMethod,
} from "../data/appointment-commands.repo";
import { assertTransition } from "../domain/lifecycle";
import {
  calculateDiscountAmount,
  calculateFinalChargedTotal,
  clampDiscountPercentage,
  roundCurrency,
} from "../domain/pricing";

export interface CompleteAppointmentPriceInput {
  id: string;
  price: number;
  discountPercentage?: number;
}

export async function completeAppointment(
  appointmentId: string,
  salonId: string,
  paymentMethod: AppointmentPaymentMethod,
  itemPrices: CompleteAppointmentPriceInput[] = [],
  completionPriceNote = ""
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;
  try {
    appointment = await findAppointmentForCommand(appointmentId, salonId);
  } catch (error) {
    captureError(error, { module: "appointments", action: "complete" });
    return err("Cita no encontrada.");
  }

  if (!appointment) return err("Cita no encontrada.");

  try {
    assertTransition(appointment.status, "completed");
  } catch (error) {
    return err(toPublicErrorMessage(error, "No se pudo completar la cita."));
  }

  let subtotal = 0;
  let discountAmount = 0;
  let finalTotal = 0;
  try {
    const currentItems = await findAppointmentItemsForPricing(appointmentId, salonId);
    if (currentItems.length === 0) return err("La cita no tiene servicios para cobrar.");

    const submittedById = new Map(itemPrices.map((item) => [item.id, item]));
    const currentIds = new Set(currentItems.map((item) => item.id));

    for (const item of itemPrices) {
      if (!currentIds.has(item.id)) return err("Precio de servicio inválido.");
      if (!Number.isFinite(item.price) || item.price < 0) {
        return err("El precio del servicio no puede ser negativo.");
      }
      const discountPercentage = Number(item.discountPercentage ?? 0);
      if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
        return err("El descuento del servicio debe estar entre 0% y 100%.");
      }
    }

    const nextCharges = currentItems.map((item) => {
      const submitted = submittedById.get(item.id);
      const nextPrice = submitted
        ? roundCurrency(Number(submitted.price))
        : roundCurrency(item.price);
      const discountPercentage = clampDiscountPercentage(
        Number(submitted?.discountPercentage ?? 0)
      );
      const discountAmount = calculateDiscountAmount(nextPrice, discountPercentage);
      const priceChanged = nextPrice !== roundCurrency(item.price);

      if (priceChanged && item.pricing_mode !== "variable") {
        throw new Error("fixed-price-change");
      }

      return { id: item.id, price: nextPrice, discountAmount };
    });

    const changedCharges = nextCharges.filter((item) => {
      const current = currentItems.find((currentItem) => currentItem.id === item.id);
      return (
        current &&
        (item.price !== roundCurrency(current.price) ||
          item.discountAmount !== roundCurrency(current.discount_amount))
      );
    });

    if (changedCharges.length > 0) {
      await updateAppointmentItemCharges({ appointmentId, salonId, charges: changedCharges });
    }

    subtotal = roundCurrency(nextCharges.reduce((sum, item) => sum + item.price, 0));
    discountAmount = roundCurrency(
      nextCharges.reduce((sum, item) => sum + item.discountAmount, 0)
    );
    finalTotal = calculateFinalChargedTotal(subtotal, discountAmount);
  } catch (error) {
    if ((error as Error).message === "fixed-price-change") {
      return err("Solo puedes cambiar el precio de servicios con precio variable.");
    }

    captureError(error, { module: "appointments", action: "complete" });
    return err("Error al calcular el cobro de la cita.");
  }

  try {
    await updateAppointmentStatus({
      appointmentId,
      salonId,
      status: "completed",
      paymentMethod,
      discountAmount,
      totalPrice: finalTotal,
      completionPriceNote: completionPriceNote.trim().slice(0, 500),
    });
  } catch (error) {
    captureError(error, { module: "appointments", action: "complete" });
    return err("Error al completar la cita.");
  }

  try {
    await setAppointmentItemsCalendarBlocking({
      appointmentId,
      salonId,
      blocksCalendar: false,
    });
  } catch (error) {
    captureError(error, { module: "appointments", action: "complete" });
    return err("La cita se completo, pero no se pudo liberar la agenda.");
  }

  if (appointment.customer_id) {
    const promoted = await promoteCustomer(appointment.customer_id, salonId);
    if (!promoted.ok) {
      captureError(promoted.error, { module: "appointments", action: "complete" });
    }
  }

  return ok(undefined);
}
