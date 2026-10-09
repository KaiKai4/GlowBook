"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/app/_composition/request-context";
import { hasPermission, PERMISSIONS } from "@/features/access";
import {
  getOccupiedSlotsForSalonDate,
  type OccupiedByEmployee,
} from "@/features/appointments/use-cases/appointment-availability";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { completeAppointment } from "@/features/appointments/use-cases/complete-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { createAppointment } from "@/features/appointments/use-cases/create-appointment";
import {
  parseCompleteAppointmentForm,
  parseCreateAppointmentForm,
  parseUpdateAppointmentScheduleForm,
} from "@/features/appointments/use-cases/appointment-form-parsing";
import { updateAppointmentSchedule } from "@/features/appointments/use-cases/update-appointment";
import { assertSalonPaymentMethodEnabled } from "@/features/salon/use-cases/salon-payment-methods";
import { checkPlanLimit, checkPlanModuleAccess } from "@/features/billing/use-cases/commercial-plans";
import { assertActionRateLimit } from "@/infra/security/rate-limit";
import { AppointmentLifecycleSchema } from "@/features/appointments/schemas";
import type { Result } from "@/infra/result";
import { firstIssueMessage } from "@/infra/validation/first-issue";
import { parseUuid } from "@/infra/validation/route-id";

async function canManageAppointments(
  profile: Awaited<ReturnType<typeof requireActiveProfile>>,
  deniedMessage: string
): Promise<Result<void>> {
  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: false, error: deniedMessage };
  }

  // Generoso para el uso real del wizard, pero frena martilleo automatizado.
  return assertActionRateLimit(profile.id, "appointments", { max: 120, windowMs: 60_000 });
}

function revalidateAppointmentFlows(): void {
  revalidatePath("/appointments");
}

// Returns blocking appointment slots for the salon on a given date, grouped by employee.
// `date` is a YYYY-MM-DD string representing a calendar day in the salon's local timezone.
// Used by the wizard to compute real availability before booking.
export async function getOccupiedSlotsForDate(date: string): Promise<OccupiedByEmployee> {
  const profile = await requireActiveProfile();
  const permission = await canManageAppointments(profile, "No tienes permiso para consultar la agenda.");
  if (!permission.ok) return {};

  return getOccupiedSlotsForSalonDate(profile.salon_id, date);
}

export async function getOccupiedSlotsForEditDate(
  date: string,
  appointmentId: string
): Promise<OccupiedByEmployee> {
  const profile = await requireActiveProfile();
  const permission = await canManageAppointments(profile, "No tienes permiso para consultar la agenda.");
  if (!permission.ok) return {};
  if (!parseUuid(appointmentId)) return {};

  return getOccupiedSlotsForSalonDate(profile.salon_id, date, appointmentId);
}

export async function createAppointmentAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  const permission = await canManageAppointments(profile, "No tienes permiso para crear citas.");
  if (!permission.ok) return permission;
  const moduleAccess = await checkPlanModuleAccess({
    salonId: profile.salon_id,
    moduleKey: "appointments",
  });
  if (!moduleAccess.ok) return { ok: false, error: moduleAccess.error };
  const limit = await checkPlanLimit({
    salonId: profile.salon_id,
    metricKey: "appointments.total",
  });
  if (!limit.ok) return { ok: false, error: limit.error };

  const input = parseCreateAppointmentForm(Object.fromEntries(formData));
  if (!input.ok) return input;

  const result = await createAppointment(input.value, {
    salonId: profile.salon_id,
    userId: profile.id,
    idempotencyKey: input.value.idempotency_key,
  });

  if (result.ok) revalidateAppointmentFlows();
  return result;
}

export async function updateAppointmentScheduleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageAppointments(profile, "No tienes permiso para editar citas.");
  if (!permission.ok) return permission;

  const input = parseUpdateAppointmentScheduleForm(Object.fromEntries(formData));
  if (!input.ok) return input;

  const result = await updateAppointmentSchedule(input.value, {
    salonId: profile.salon_id,
    idempotencyKey: input.value.idempotency_key,
  });

  if (result.ok) revalidateAppointmentFlows();
  return result;
}

export async function cancelAppointmentAction(formData: FormData): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageAppointments(profile, "No tienes permiso para cancelar citas.");
  if (!permission.ok) return permission;

  const parsed = AppointmentLifecycleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await cancelAppointment(
    parsed.data.appointment_id,
    profile.salon_id,
    parsed.data.idempotency_key
  );
  if (result.ok) revalidateAppointmentFlows();
  return result;
}

export async function confirmAppointmentAction(formData: FormData): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageAppointments(profile, "No tienes permiso para confirmar citas.");
  if (!permission.ok) return permission;

  const parsed = AppointmentLifecycleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const result = await confirmAppointment(
    parsed.data.appointment_id,
    profile.salon_id,
    parsed.data.idempotency_key
  );
  if (result.ok) revalidateAppointmentFlows();
  return result;
}

export async function completeAppointmentAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = await canManageAppointments(profile, "No tienes permiso para completar citas.");
  if (!permission.ok) return permission;

  const input = await parseCompleteAppointmentForm(formData, (method) =>
    assertSalonPaymentMethodEnabled(profile.salon_id, method)
  );
  if (!input.ok) return input;

  const result = await completeAppointment(
    input.value.appointment_id,
    profile.salon_id,
    input.value.payment_method,
    input.value.item_charges,
    input.value.completion_price_note,
    input.value.idempotency_key
  );

  if (result.ok) {
    revalidateAppointmentFlows();
    revalidatePath("/customers");
  }

  return result;
}
