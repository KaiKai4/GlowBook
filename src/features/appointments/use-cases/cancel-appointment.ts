import { toPublicErrorMessage } from "@/infra/errors";
import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import {
  deleteTemporaryCustomer,
  isTemporaryCustomer,
  promoteCustomer,
} from "@/features/customers";
import {
  findAppointmentForCommand,
  type AppointmentCommandState,
} from "../data/appointment-commands.repo";
import {
  cancelAppointmentRpc,
  type CancelAppointmentRpcResult,
} from "../data/rpc/cancel-appointment";
import { temporaryCustomerActionFor } from "../domain/cancellation-message";
import { assertTransition } from "../domain/lifecycle";
import { APPOINTMENT_MESSAGES } from "../domain/messages";

/** Decisión del usuario sobre el cliente temporal de la cita al cancelarla. */
type CustomerDisposition = "keep" | "promote" | "discard";

export interface CancelAppointmentInput {
  appointmentId: string;
  salonId: string;
  idempotencyKey: string;
  customerDisposition: CustomerDisposition;
}

/** Dependencias del caso de uso. Producción usa las funciones reales; los tests inyectan fakes. */
export interface CancelAppointmentDeps {
  findAppointment: (appointmentId: string, salonId: string) => Promise<AppointmentCommandState | null>;
  cancelRpc: (input: { appointmentId: string; idempotencyKey: string }) => Promise<CancelAppointmentRpcResult>;
  isTemporaryCustomer: (customerId: string, salonId: string) => Promise<boolean>;
  promoteCustomer: (customerId: string, salonId: string) => Promise<Result<void>>;
  deleteTemporaryCustomer: (customerId: string, salonId: string) => Promise<Result<void>>;
}

const defaultCancelAppointmentDeps: CancelAppointmentDeps = {
  findAppointment: findAppointmentForCommand,
  cancelRpc: cancelAppointmentRpc,
  isTemporaryCustomer,
  promoteCustomer,
  deleteTemporaryCustomer,
};

const PROMOTE_WARNING = "La cita se canceló, pero no pudimos guardar al cliente:";
const DISCARD_WARNING = "La cita se canceló, pero no pudimos descartar los datos temporales del cliente:";
const CUSTOMER_STEP_WARNING = "La cita se canceló, pero no pudimos actualizar los datos del cliente.";

/**
 * Cancela la cita en una sola RPC (cierre y liberación de agenda) y después aplica la
 * decisión sobre el cliente temporal. Si la cancelación va bien pero el cliente falla,
 * el resultado sigue siendo ok y el aviso viaja en `warnings`.
 */
export async function cancelAppointment(
  input: CancelAppointmentInput,
  deps: CancelAppointmentDeps = defaultCancelAppointmentDeps
): Promise<Result<void>> {
  const { appointmentId, salonId, idempotencyKey, customerDisposition } = input;

  let appointment: AppointmentCommandState | null;
  try {
    appointment = await deps.findAppointment(appointmentId, salonId);
  } catch (error) {
    captureError(error, { module: "appointments", action: "cancel" });
    return err(APPOINTMENT_MESSAGES.notFound);
  }

  if (!appointment) return err(APPOINTMENT_MESSAGES.notFound);

  try {
    assertTransition(appointment.status, "cancelled");
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.cancelFailed));
  }

  try {
    await deps.cancelRpc({ appointmentId, idempotencyKey });
  } catch (error) {
    return err(toPublicErrorMessage(error, APPOINTMENT_MESSAGES.cancelError));
  }

  const warnings = await applyCustomerDisposition(
    appointment.customer_id,
    salonId,
    customerDisposition,
    deps
  );
  return ok(undefined, warnings);
}

/** Aplica la decisión sobre el cliente temporal. Devuelve avisos; nunca hace fallar la cancelación. */
async function applyCustomerDisposition(
  customerId: string | null,
  salonId: string,
  disposition: CustomerDisposition,
  deps: CancelAppointmentDeps
): Promise<string[]> {
  if (!customerId || disposition === "keep") return [];

  try {
    const isTemporary = await deps.isTemporaryCustomer(customerId, salonId);
    const action = temporaryCustomerActionFor(isTemporary, disposition === "promote" ? "save" : "discard");

    if (action === "promote") {
      const res = await deps.promoteCustomer(customerId, salonId);
      return res.ok ? [] : [`${PROMOTE_WARNING} ${res.error}`];
    }
    if (action === "discard") {
      const res = await deps.deleteTemporaryCustomer(customerId, salonId);
      return res.ok ? [] : [`${DISCARD_WARNING} ${res.error}`];
    }
    return [];
  } catch (error) {
    captureError(error, { module: "appointments", action: "cancel-customer" });
    return [CUSTOMER_STEP_WARNING];
  }
}
