import { err, ok, type Result } from "@/infra/result";
import { captureError } from "@/infra/observability";
import {
  createAppointmentWithRpc,
  type CreateAppointmentRpcPayload,
} from "../data/rpc/create-appointment";
import type { CreateAppointmentInput } from "../schemas";
import { APPOINTMENT_MESSAGES } from "../domain/messages";
import { prepareAppointmentItems } from "./prepare-appointment-items";

/** Dependencias del caso de uso. Producción usa las funciones reales; los tests inyectan fakes. */
export interface CreateAppointmentDeps {
  prepareAppointmentItems: typeof prepareAppointmentItems;
  createAppointmentWithRpc: typeof createAppointmentWithRpc;
}

const defaultCreateAppointmentDeps: CreateAppointmentDeps = {
  prepareAppointmentItems,
  createAppointmentWithRpc,
};

interface Deps {
  salonId: string;
  userId: string;
  /** Clave de idempotencia del formulario (uuid). Un reenvio no crea una segunda cita. */
  idempotencyKey: string;
}

const INACTIVE_CUSTOMER_MESSAGE =
  "Este cliente no está disponible para nuevas citas. Restauralo desde Clientes para conservar su historial.";

function toRpcNewCustomer(customer: NonNullable<CreateAppointmentInput["new_customer"]>) {
  const phone = customer.phone?.trim();
  return {
    first_name: customer.first_name,
    last_name: customer.last_name,
    ...(phone ? { phone } : {}),
  };
}

export async function createAppointment(
  input: CreateAppointmentInput,
  { salonId, userId, idempotencyKey }: Deps,
  deps: CreateAppointmentDeps = defaultCreateAppointmentDeps
): Promise<Result<string>> {
  const prepared = await deps.prepareAppointmentItems({
    salonId,
    customerId: input.customer_id,
    assignments: input.assignments,
    startTime: input.start_time,
    action: "create",
  });
  if (!prepared.ok) return err(prepared.error);

  const rpcPayload: CreateAppointmentRpcPayload = {
    salon_id: salonId,
    ...(input.new_customer
      ? { new_customer: toRpcNewCustomer(input.new_customer) }
      : { customer_id: input.customer_id }),
    created_by: userId,
    notes: input.notes ?? "",
    items: prepared.value.items,
  };

  let created: Awaited<ReturnType<typeof createAppointmentWithRpc>>;
  try {
    created = await deps.createAppointmentWithRpc({ payload: rpcPayload, idempotencyKey });
  } catch (error) {
    captureError(error, { module: "appointments", action: "create" });
    return err(APPOINTMENT_MESSAGES.createFailed);
  }

  if (!created.ok) {
    if (created.reason === "slot_taken") {
      return err(APPOINTMENT_MESSAGES.slotTaken);
    }
    if (created.reason === "inactive_customer") {
      return err(INACTIVE_CUSTOMER_MESSAGE);
    }
    return err(APPOINTMENT_MESSAGES.createFailed);
  }

  return ok(created.appointmentId as string);
}
