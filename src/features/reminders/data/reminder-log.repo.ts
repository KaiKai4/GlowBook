import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type ReminderLogInsert = Database["public"]["Tables"]["appointment_reminder_log"]["Insert"];

export interface ReminderLogSummary {
  appointment_id: string;
  sent_at: string;
  channel: string;
}

export async function findLatestReminderLogsByAppointmentIds(
  salonId: string,
  appointmentIds: string[]
): Promise<Map<string, ReminderLogSummary>> {
  if (appointmentIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointment_reminder_log")
    .select("appointment_id, sent_at, channel")
    .eq("salon_id", salonId)
    .in("appointment_id", appointmentIds)
    .order("sent_at", { ascending: false });

  if (error) throw error;

  const latest = new Map<string, ReminderLogSummary>();
  for (const row of data ?? []) {
    if (!latest.has(row.appointment_id)) {
      latest.set(row.appointment_id, row as ReminderLogSummary);
    }
  }

  return latest;
}

export async function createManualReminderLog(input: {
  salonId: string;
  appointmentId: string;
  templateId?: string;
  recipientPhone?: string;
  userId: string;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const payload: ReminderLogInsert = {
    salon_id: input.salonId,
    appointment_id: input.appointmentId,
    template_id: input.templateId || null,
    channel: "whatsapp",
    recipient_phone: input.recipientPhone || null,
    created_by: input.userId,
  };

  const { data, error } = await supabase
    .from("appointment_reminder_log")
    .insert(payload)
    .select("sent_at")
    .single();

  if (error) throw error;
  return data.sent_at;
}
