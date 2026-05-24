"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUtcDayBoundaries } from "@/lib/utils/dates";
import { createAppointment } from "@/features/appointments/use-cases/create-appointment";
import { cancelAppointment } from "@/features/appointments/use-cases/cancel-appointment";
import { completeAppointment } from "@/features/appointments/use-cases/complete-appointment";
import { confirmAppointment } from "@/features/appointments/use-cases/confirm-appointment";
import { CreateAppointmentSchema, UpdateAppointmentStatusSchema } from "@/features/appointments/schemas";
import type { Result } from "@/lib/result";

export type OccupiedByEmployee = Record<string, { start_time: string; end_time: string }[]>;

// Returns blocking appointment slots for the salon on a given date, grouped by employee.
// `date` is a YYYY-MM-DD string representing a calendar day in the salon's local timezone.
// Used by the wizard to compute real availability before booking.
export async function getOccupiedSlotsForDate(date: string): Promise<OccupiedByEmployee> {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISSIONS.APPOINTMENTS_MANAGE)) return {};

  const supabase = await createSupabaseServerClient();

  const { data: salonData } = await supabase
    .from("salons")
    .select("timezone")
    .eq("id", profile.salon_id)
    .single();

  const timezone = salonData?.timezone ?? "UTC";

  // Build a probe date that falls on `date` in the salon's timezone.
  // Noon UTC on the given date is within 12 hours of local midnight, so a single
  // ±12 h adjustment always lands on the correct day for any IANA timezone.
  let probe = new Date(`${date}T12:00:00.000Z`);
  const probeLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(probe);
  if (probeLocal !== date) {
    const delta = probeLocal > date ? -12 : 12;
    probe = new Date(probe.getTime() + delta * 60 * 60_000);
  }
  const { start: dayStart, end: dayEnd } = getUtcDayBoundaries(probe, timezone);

  const { data } = await supabase
    .from("appointment_items")
    .select("employee_id, start_time, end_time")
    .eq("salon_id", profile.salon_id)
    .eq("blocks_calendar", true)
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString());

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

  const supabase = await createSupabaseServerClient();

  // Apply discount to item prices before completing.
  // The recalc_appointment trigger recalculates total_price automatically after each update.
  const discountPct = parseFloat(formData.get("discount_percentage") as string ?? "0");
  if (!isNaN(discountPct) && discountPct > 0 && discountPct <= 100) {
    const factor = 1 - discountPct / 100;
    const { data: items } = await supabase
      .from("appointment_items")
      .select("id, price")
      .eq("appointment_id", parsed.data.appointment_id);

    if (items) {
      for (const item of items) {
        const newPrice = Math.round(Number(item.price) * factor * 100) / 100;
        await supabase
          .from("appointment_items")
          .update({ price: newPrice })
          .eq("id", item.id);
      }
    }
  }

  const result = await completeAppointment(
    parsed.data.appointment_id,
    profile.salon_id,
    parsed.data.payment_method ?? ""
  );

  if (result.ok) {
    // Promote temporary customer to permanent when appointment is completed.
    const { data: appt } = await supabase
      .from("appointments")
      .select("customer_id")
      .eq("id", parsed.data.appointment_id)
      .single();
    if (appt?.customer_id) {
      await supabase
        .from("customers")
        .update({ is_temporary: false, is_active: true })
        .eq("id", appt.customer_id)
        .eq("salon_id", profile.salon_id)
        .eq("is_temporary", true);
    }
    revalidatePath("/appointments");
    revalidatePath("/customers");
  }
  return result;
}
