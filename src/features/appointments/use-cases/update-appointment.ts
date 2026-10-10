import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import { findAppointmentForCommand } from "../data/appointment-commands.repo";
import {
  updateAppointmentWithRpc,
  type UpdateAppointmentRpcPayload,
} from "../data/rpc/update-appointment";
import type { UpdateAppointmentScheduleInput } from "../schemas";
import { canEditSchedule } from "../domain/lifecycle";
import { APPOINTMENT_MESSAGES } from "../domain/messages";
import { prepareAppointmentItems } from "./prepare-appointment-items";

interface Deps {
  salonId: string;
  /** Clave de idempotencia del formulario (uuid). Un reenvio no reemplaza los items dos veces. */
  idempotencyKey: string;
}

export async function updateAppointmentSchedule(
  input: UpdateAppointmentScheduleInput,
  { salonId, idempotencyKey }: Deps
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;

  try {
    appointment = await findAppointmentForCommand(input.appointment_id, salonId);
  } catch (error) {
    captureError(error, { module: "appointments", action: "update" });
    return err(APPOINTMENT_MESSAGES.loadFailed);
  }

  if (!appointment) return err(APPOINTMENT_MESSAGES.notFoundInSalon);
  if (!canEditSchedule(appointment.status)) {
    return err(APPOINTMENT_MESSAGES.closedNotEditable);
  }
  if (!appointment.customer_id) return err(APPOINTMENT_MESSAGES.missingCustomer);

  const prepared = await prepareAppointmentItems({
    salonId,
    customerId: appointment.customer_id,
    assignments: input.assignments,
    startTime: input.start_time,
    excludeAppointmentId: input.appointment_id,
    action: "update",
  });
  if (!prepared.ok) return err(prepared.error);

  const rpcPayload: UpdateAppointmentRpcPayload = {
    appointment_id: input.appointment_id,
    notes: input.notes ?? "",
    items: prepared.value.items,
  };

  let updated: Awaited<ReturnType<typeof updateAppointmentWithRpc>>;
  try {
    updated = await updateAppointmentWithRpc({ payload: rpcPayload, idempotencyKey });
  } catch (error) {
    captureError(error, { module: "appointments", action: "update" });
    return err(APPOINTMENT_MESSAGES.updateFailed);
  }

  if (!updated.ok) {
    if (updated.reason === "slot_taken") {
      return err(APPOINTMENT_MESSAGES.slotTaken);
    }
    return err(APPOINTMENT_MESSAGES.updateFailed);
  }

  return ok(undefined);
}
