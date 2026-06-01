"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  getOccupiedSlotsForSalonDate,
  type OccupiedByEmployee,
} from "@/features/appointments/use-cases/appointment-availability";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { completeAppointment } from "@/features/appointments/use-cases/complete-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { createAppointment } from "@/features/appointments/use-cases/create-appointment";
import { updateAppointmentSchedule } from "@/features/appointments/use-cases/update-appointment";
import {
  CreateAppointmentSchema,
  UpdateAppointmentScheduleSchema,
  UpdateAppointmentStatusSchema,
} from "@/features/appointments/schemas";
import type { Result } from "@/lib/result";

function canManageAppointments(
  profile: Awaited<ReturnType<typeof requireActiveProfile>>
): Result<void> {
  if (hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: true, value: undefined };
  }

  return { ok: false, error: "No tienes permiso para gestionar citas." };
}

function revalidateAppointmentFlows(appointmentId?: string): void {
  revalidatePath("/appointments");
  if (appointmentId) revalidatePath(`/appointments/${appointmentId}`);
}

// Returns blocking appointment slots for the salon on a given date, grouped by employee.
// `date` is a YYYY-MM-DD string representing a calendar day in the salon's local timezone.
// Used by the wizard to compute real availability before booking.
export async function getOccupiedSlotsForDate(date: string): Promise<OccupiedByEmployee> {
  const profile = await requireActiveProfile();
  const permission = canManageAppointments(profile);
  if (!permission.ok) return {};

  return getOccupiedSlotsForSalonDate(profile.salon_id, date);
}

export async function getOccupiedSlotsForEditDate(
  date: string,
  appointmentId: string
): Promise<OccupiedByEmployee> {
  const profile = await requireActiveProfile();
  const permission = canManageAppointments(profile);
  if (!permission.ok) return {};

  return getOccupiedSlotsForSalonDate(profile.salon_id, date, appointmentId);
}

export async function createAppointmentAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const profile = await requireActiveProfile();
  const permission = canManageAppointments(profile);
  if (!permission.ok) return { ok: false, error: "No tienes permiso para crear citas." };

  const raw = Object.fromEntries(formData);
  let assignments: unknown;
  try {
    assignments = JSON.parse(raw.assignments as string);
  } catch {
    return { ok: false, error: "Datos de servicios invalidos." };
  }

  const parsed = CreateAppointmentSchema.safeParse({
    ...raw,
    assignments,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const result = await createAppointment(parsed.data, {
    salonId: profile.salon_id,
    userId: profile.id,
  });

  if (result.ok) revalidateAppointmentFlows();
  return result;
}

export async function updateAppointmentScheduleAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = canManageAppointments(profile);
  if (!permission.ok) return { ok: false, error: "No tienes permiso para editar citas." };

  const raw = Object.fromEntries(formData);
  let assignments: unknown;
  try {
    assignments = JSON.parse(raw.assignments as string);
  } catch {
    return { ok: false, error: "Datos de servicios invalidos." };
  }

  const parsed = UpdateAppointmentScheduleSchema.safeParse({
    ...raw,
    assignments,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const result = await updateAppointmentSchedule(parsed.data, {
    salonId: profile.salon_id,
  });

  if (result.ok) revalidateAppointmentFlows(parsed.data.appointment_id);
  return result;
}

export async function cancelAppointmentAction(
  appointmentId: string
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = canManageAppointments(profile);
  if (!permission.ok) return { ok: false, error: "No tienes permiso para cancelar citas." };

  const result = await cancelAppointment(appointmentId, profile.salon_id);
  if (result.ok) revalidateAppointmentFlows(appointmentId);
  return result;
}

export async function confirmAppointmentAction(
  appointmentId: string
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = canManageAppointments(profile);
  if (!permission.ok) return { ok: false, error: "No tienes permiso para confirmar citas." };

  const result = await confirmAppointment(appointmentId, profile.salon_id);
  if (result.ok) revalidateAppointmentFlows(appointmentId);
  return result;
}

export async function completeAppointmentAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireActiveProfile();
  const permission = canManageAppointments(profile);
  if (!permission.ok) return { ok: false, error: "No tienes permiso para completar citas." };

  const parsed = UpdateAppointmentStatusSchema.safeParse({
    appointment_id: formData.get("appointment_id"),
    status: "completed",
    payment_method: formData.get("payment_method"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const discountPct = parseFloat(formData.get("discount_percentage") as string ?? "0");
  const validDiscountPct = !isNaN(discountPct) && discountPct > 0 && discountPct <= 100
    ? discountPct
    : 0;

  const result = await completeAppointment(
    parsed.data.appointment_id,
    profile.salon_id,
    parsed.data.payment_method ?? "",
    validDiscountPct
  );

  if (result.ok) {
    revalidateAppointmentFlows(parsed.data.appointment_id);
    revalidatePath("/customers");
  }

  return result;
}
