"use server";

import { defineAction, parseWithSchema } from "@/app/_composition/define-action";
import { PERMISSIONS } from "@/features/access";
import {
  AppointmentLifecycleSchema,
  CancelAppointmentSchema,
  type CompleteAppointmentResult,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  type CompleteAppointmentInput,
  createAppointmentWithPlanChecks,
  type CreateAppointmentInput,
  getOccupiedSlotsForSalonDate,
  type OccupiedByEmployee,
  parseCompleteAppointmentForm,
  parseCreateAppointmentForm,
  parseUpdateAppointmentScheduleForm,
  type UpdateAppointmentScheduleInput,
  updateAppointmentSchedule,
} from "@/features/appointments";
import type { z } from "@/infra/validation/zod";
import { err, ok, type Result } from "@/infra/result";
import { parseUuid } from "@/infra/validation/route-id";

// Las acciones solo orquestan: contexto, permiso por clave, rate limit, validacion
// y UNA llamada a un caso de uso (defineAction). Las reglas viven en los casos de uso.

// Generoso para el uso real del wizard, pero frena martilleo automatizado.
const APPOINTMENTS_RATE_LIMIT = { scope: "appointments", options: { max: 120, windowMs: 60_000 } };
const APPOINTMENT_PATHS = ["/appointments"] as const;
const COMPLETE_PATHS = ["/appointments", "/customers"] as const;
const INVALID_ID_MESSAGE = "Identificador inválido.";

type AppointmentLifecycleInput = z.infer<typeof AppointmentLifecycleSchema>;
type CancelAppointmentFormInput = z.infer<typeof CancelAppointmentSchema>;
type LifecycleCommand = (appointmentId: string, salonId: string, idempotencyKey: string) => Promise<Result<void>>;

// Returns blocking appointment slots for the salon on a given date, grouped by employee.
// `date` is a YYYY-MM-DD string representing a calendar day in the salon's local timezone.
// Used by the wizard to compute real availability before booking.
const occupiedSlotsForDateFlow = defineAction<string, string, OccupiedByEmployee>({
  permission: { key: PERMISSIONS.APPOINTMENTS_MANAGE, deniedMessage: "No tienes permiso para consultar la agenda." },
  rateLimit: APPOINTMENTS_RATE_LIMIT,
  parse: (date) => ok(date),
  run: async (date, session) => ok(await getOccupiedSlotsForSalonDate(session.salonId, date)),
});

const occupiedSlotsForEditFlow = defineAction<
  { date: string; appointmentId: string },
  { date: string; appointmentId: string },
  OccupiedByEmployee
>({
  permission: { key: PERMISSIONS.APPOINTMENTS_MANAGE, deniedMessage: "No tienes permiso para consultar la agenda." },
  rateLimit: APPOINTMENTS_RATE_LIMIT,
  parse: (raw) => (parseUuid(raw.appointmentId) ? ok(raw) : err(INVALID_ID_MESSAGE)),
  run: async ({ date, appointmentId }, session) =>
    ok(await getOccupiedSlotsForSalonDate(session.salonId, date, appointmentId)),
});

const createAppointmentFlow = defineAction<FormData, CreateAppointmentInput, string>({
  permission: { key: PERMISSIONS.APPOINTMENTS_MANAGE, deniedMessage: "No tienes permiso para crear citas." },
  rateLimit: APPOINTMENTS_RATE_LIMIT,
  parse: (formData) => parseCreateAppointmentForm(Object.fromEntries(formData)),
  run: (input, session) => createAppointmentWithPlanChecks(input, { salonId: session.salonId, userId: session.userId }),
  revalidate: () => APPOINTMENT_PATHS,
});

const updateAppointmentScheduleFlow = defineAction<FormData, UpdateAppointmentScheduleInput, void>({
  permission: { key: PERMISSIONS.APPOINTMENTS_MANAGE, deniedMessage: "No tienes permiso para editar citas." },
  rateLimit: APPOINTMENTS_RATE_LIMIT,
  parse: (formData) => parseUpdateAppointmentScheduleForm(Object.fromEntries(formData)),
  run: (input, session) =>
    updateAppointmentSchedule(input, { salonId: session.salonId, idempotencyKey: input.idempotency_key }),
  revalidate: () => APPOINTMENT_PATHS,
});

function lifecycleFlow(deniedMessage: string, command: LifecycleCommand) {
  const parseLifecycle = parseWithSchema(AppointmentLifecycleSchema);
  return defineAction<FormData, AppointmentLifecycleInput, void>({
    permission: { key: PERMISSIONS.APPOINTMENTS_MANAGE, deniedMessage },
    rateLimit: APPOINTMENTS_RATE_LIMIT,
    parse: (formData) => parseLifecycle(Object.fromEntries(formData)),
    run: (input, session) => command(input.appointment_id, session.salonId, input.idempotency_key),
    revalidate: () => APPOINTMENT_PATHS,
  });
}

const parseCancelAppointment = parseWithSchema(CancelAppointmentSchema);
const cancelAppointmentFlow = defineAction<FormData, CancelAppointmentFormInput, void>({
  permission: { key: PERMISSIONS.APPOINTMENTS_MANAGE, deniedMessage: "No tienes permiso para cancelar citas." },
  rateLimit: APPOINTMENTS_RATE_LIMIT,
  parse: (formData) => parseCancelAppointment(Object.fromEntries(formData)),
  run: (input, session) =>
    cancelAppointment({
      appointmentId: input.appointment_id,
      salonId: session.salonId,
      idempotencyKey: input.idempotency_key,
      customerDisposition: input.customer_disposition,
    }),
  revalidate: () => APPOINTMENT_PATHS,
});
const confirmAppointmentFlow = lifecycleFlow("No tienes permiso para confirmar citas.", confirmAppointment);

const completeAppointmentFlow = defineAction<FormData, CompleteAppointmentInput, CompleteAppointmentResult>({
  permission: { key: PERMISSIONS.APPOINTMENTS_MANAGE, deniedMessage: "No tienes permiso para completar citas." },
  rateLimit: APPOINTMENTS_RATE_LIMIT,
  parse: (formData) => parseCompleteAppointmentForm(formData),
  run: (input, session) =>
    completeAppointment({
      appointmentId: input.appointment_id,
      salonId: session.salonId,
      paymentMethod: input.payment_method,
      itemCharges: input.item_charges,
      completionPriceNote: input.completion_price_note,
      idempotencyKey: input.idempotency_key,
    }),
  revalidate: () => COMPLETE_PATHS,
});

export async function getOccupiedSlotsForDate(date: string): Promise<OccupiedByEmployee> {
  const result = await occupiedSlotsForDateFlow(date);
  return result.ok ? result.value : {};
}

export async function getOccupiedSlotsForEditDate(
  date: string,
  appointmentId: string
): Promise<OccupiedByEmployee> {
  const result = await occupiedSlotsForEditFlow({ date, appointmentId });
  return result.ok ? result.value : {};
}

export async function createAppointmentAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  return createAppointmentFlow(formData);
}

export async function updateAppointmentScheduleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  return updateAppointmentScheduleFlow(formData);
}

export async function cancelAppointmentAction(formData: FormData): Promise<Result<void>> {
  return cancelAppointmentFlow(formData);
}

export async function confirmAppointmentAction(formData: FormData): Promise<Result<void>> {
  return confirmAppointmentFlow(formData);
}

export async function completeAppointmentAction(
  _prev: Result<CompleteAppointmentResult> | null,
  formData: FormData
): Promise<Result<CompleteAppointmentResult>> {
  return completeAppointmentFlow(formData);
}
