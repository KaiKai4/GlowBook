import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SalonSettings {
  id: string;
  name: string;
  timezone: string;
  theme: string;
  bg_style: string | null;
}

export interface SalonIdentity {
  name: string;
  timezone: string;
}

export interface AppointmentSalonConfig {
  min_booking_notice_minutes: number;
  min_appointment_duration_minutes: number;
  allow_off_hours_bookings: boolean;
  timezone: string;
}

export interface BusinessHourRow {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

export async function findSalonSettings(salonId: string): Promise<SalonSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salons")
    .select("id, name, timezone, theme, bg_style")
    .eq("id", salonId)
    .single();
  return data ?? null;
}

export async function findSalonIdentity(salonId: string): Promise<SalonIdentity | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salons")
    .select("name, timezone")
    .eq("id", salonId)
    .single();

  return data ?? null;
}

export async function findAppointmentSalonConfig(
  salonId: string
): Promise<AppointmentSalonConfig | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salons")
    .select(
      "min_booking_notice_minutes, min_appointment_duration_minutes, allow_off_hours_bookings, timezone"
    )
    .eq("id", salonId)
    .single();

  return data ?? null;
}

export async function findBusinessHours(salonId: string): Promise<BusinessHourRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salon_business_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("salon_id", salonId)
    .order("day_of_week", { ascending: true });
  return data ?? [];
}
