import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing";
import type { CreateAppointmentInput } from "@/features/appointments/schemas";
import { err, type Result } from "@/infra/result";
import { createAppointment } from "./create-appointment";

interface GuardedCreateContext {
  salonId: string;
  userId: string;
}

/**
 * Crea la cita solo si el plan del salon da acceso al modulo de citas y queda
 * cupo de citas. Los cupos son una regla de negocio: la accion solo orquesta.
 */
export async function createAppointmentGuarded(
  input: CreateAppointmentInput,
  { salonId, userId }: GuardedCreateContext
): Promise<Result<string>> {
  const moduleAccess = await checkPlanModuleAccess({ salonId, moduleKey: "appointments" });
  if (!moduleAccess.ok) return err(moduleAccess.error);

  const limit = await checkPlanLimit({ salonId, metricKey: "appointments.total" });
  if (!limit.ok) return err(limit.error);

  // Cliente nuevo: no se comprueba el cupo de clientes. Se crea temporal e inactivo, asi que no
  // consume customers.active; el limite se aplica al convertirlo en definitivo.
  return createAppointment(input, { salonId, userId, idempotencyKey: input.idempotency_key });
}
