"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAppointment } from "@/features/appointments/use-cases/create-appointment";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { completeAppointment } from "@/features/appointments/use-cases/complete-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { CreateAppointmentSchema, UpdateAppointmentStatusSchema } from "@/features/appointments/schemas";
import type { Result } from "@/lib/result";

export type OccupiedByEmployee = Record<string, { start_time: string; end_time: string }[]>;

// Returns blocking appointment slots for the salon on a given date, grouped by employee.
// Used by the wizard to compute real availability before booking.
export async function getOccupiedSlotsForDate(date: string): Promise<OccupiedByEmployee> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) return {};

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointment_items")
    .select("employee_id, start_time, end_time")
    .eq("salon_id", profile.salon_id)
    .eq("blocks_calendar", true)
    .gte("start_time", `${date}T00:00:00`)
    .lte("start_time", `${date}T23:59:59`);

  const map: OccupiedByEmployee = {};
  for (const it of data ?? []) {
    (map[it.employee_id] ??= []).push({ start_time: it.start_time, end_time: it.end_time });
  }
  return map;
}

export async function createAppointmentAction(
  _prev: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para crear citas." };
  }

  const raw = Object.fromEntries(formData);
  const parsed = CreateAppointmentSchema.safeParse({
    ...raw,
    assignments: JSON.parse(raw.assignments as string),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const result = await createAppointment(parsed.data, {
    salonId: profile.salon_id,
    userId: profile.id,
  });

  if (result.ok) revalidatePath("/appointments");
  return result;
}

export async function cancelAppointmentAction(
  appointmentId: string
): Promise<Result<void>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para cancelar citas." };
  }

  const result = await cancelAppointment(appointmentId, profile.salon_id);
  if (result.ok) {
    revalidatePath("/appointments");
    revalidatePath(`/appointments/${appointmentId}`);
  }
  return result;
}

export async function confirmAppointmentAction(
  appointmentId: string
): Promise<Result<void>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para confirmar citas." };
  }

  const result = await confirmAppointment(appointmentId, profile.salon_id);
  if (result.ok) {
    revalidatePath("/appointments");
    revalidatePath(`/appointments/${appointmentId}`);
  }
  return result;
}

export async function deactivateCustomerAction(customerId: string): Promise<Result<void>> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.CUSTOMERS_MANAGE)) {
    return { ok: false, error: "Sin permiso para gestionar clientes." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_active: false })
    .eq("id", customerId)
    .eq("salon_id", profile.salon_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/customers");
  return { ok: true, value: undefined };
}

export async function completeAppointmentAction(
  _prev: Result<void> | null,
  formData: FormData
): Promise<Result<void>> {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) {
    return { ok: false, error: "No tienes permiso para completar citas." };
  }

  const parsed = UpdateAppointmentStatusSchema.safeParse({
    appointment_id: formData.get("appointment_id"),
    status: "completed",
    payment_method: formData.get("payment_method"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const result = await completeAppointment(
    parsed.data.appointment_id,
    profile.salon_id,
    parsed.data.payment_method ?? ""
  );

  if (result.ok) revalidatePath("/appointments");
  return result;
}
