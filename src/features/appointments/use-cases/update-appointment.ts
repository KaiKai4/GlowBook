import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import {
  findAppointmentForCommand,
  findAppointmentServiceIdsForCommand,
} from "../data/appointment-commands.repo";
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

/** Dependencias del caso de uso. Producción usa las funciones reales; los tests inyectan fakes. */
export interface UpdateAppointmentDeps {
  findAppointmentForCommand: typeof findAppointmentForCommand;
  findAppointmentServiceIdsForCommand: typeof findAppointmentServiceIdsForCommand;
  prepareAppointmentItems: typeof prepareAppointmentItems;
  updateAppointmentWithRpc: typeof updateAppointmentWithRpc;
}

const defaultUpdateAppointmentDeps: UpdateAppointmentDeps = {
  findAppointmentForCommand,
  findAppointmentServiceIdsForCommand,
  prepareAppointmentItems,
  updateAppointmentWithRpc,
};

export async function updateAppointmentSchedule(
  input: UpdateAppointmentScheduleInput,
  { salonId, idempotencyKey }: Deps,
  deps: UpdateAppointmentDeps = defaultUpdateAppointmentDeps
): Promise<Result<void>> {
  let appointment: Awaited<ReturnType<typeof findAppointmentForCommand>>;
  let currentServiceIds: string[] = [];

  try {
    appointment = await deps.findAppointmentForCommand(input.appointment_id, salonId);
    // Servicios que la cita ya tiene: si siguen asignados aunque se hayan desactivado, se conservan.
    if (appointment) {
      currentServiceIds = await deps.findAppointmentServiceIdsForCommand(input.appointment_id, salonId);
    }
  } catch (error) {
    captureError(error, { module: "appointments", action: "update" });
    return err(APPOINTMENT_MESSAGES.loadFailed);
  }

  if (!appointment) return err(APPOINTMENT_MESSAGES.notFoundInSalon);
  if (!canEditSchedule(appointment.status)) {
    return err(APPOINTMENT_MESSAGES.closedNotEditable);
  }
  if (!appointment.customer_id) return err(APPOINTMENT_MESSAGES.missingCustomer);

  const prepared = await deps.prepareAppointmentItems({
    salonId,
    customerId: appointment.customer_id,
    assignments: input.assignments,
    startTime: input.start_time,
    excludeAppointmentId: input.appointment_id,
    allowedInactiveServiceIds: new Set(currentServiceIds),
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
    updated = await deps.updateAppointmentWithRpc({ payload: rpcPayload, idempotencyKey });
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
