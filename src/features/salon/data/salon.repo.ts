import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export interface SalonSettings {
  id: string;
  name: string;
  timezone: string;
  theme: string;
  bg_style: string | null;
  payment_methods: string[];
}

export interface SalonIdentity {
  name: string;
  timezone: string;
  payment_methods: string[];
}

export interface DashboardShellSalon {
  name: string;
  is_active: boolean;
  theme: string;
  bg_style: string | null;
  disabled_features: string[];
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

export type UpsertBusinessHourRow =
  Database["public"]["Tables"]["salon_business_hours"]["Insert"];

function isMissingPaymentMethodsColumn(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("payment_methods")
  );
}

export async function findSalonSettings(salonId: string): Promise<SalonSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salons")
    .select("id, name, timezone, theme, bg_style, payment_methods")
    .eq("id", salonId)
    .single();

  if (isMissingPaymentMethodsColumn(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("salons")
      .select("id, name, timezone, theme, bg_style")
      .eq("id", salonId)
      .single();

    if (fallbackError) throw fallbackError;
    return fallbackData ? { ...fallbackData, payment_methods: [] } : null;
  }

  if (error) throw error;

  return data ?? null;
}

export async function findSalonIdentity(salonId: string): Promise<SalonIdentity | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salons")
    .select("name, timezone, payment_methods")
    .eq("id", salonId)
    .single();

  if (isMissingPaymentMethodsColumn(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("salons")
      .select("name, timezone")
      .eq("id", salonId)
      .single();

    if (fallbackError) throw fallbackError;
    return fallbackData ? { ...fallbackData, payment_methods: [] } : null;
  }

  if (error) throw error;

  return data ?? null;
}

export async function findDashboardShellSalon(
  salonId: string
): Promise<DashboardShellSalon | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("salons")
    .select("name, is_active, theme, bg_style, disabled_features")
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

export async function updateSalonName(salonId: string, name: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salons")
    .update({ name })
    .eq("id", salonId);

  if (error) throw error;
}

export async function updateSalonTheme(salonId: string, theme: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salons")
    .update({ theme })
    .eq("id", salonId);

  if (error) throw error;
}

export async function updateSalonBackground(salonId: string, bgStyle: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salons")
    .update({ bg_style: bgStyle })
    .eq("id", salonId);

  if (error) throw error;
}

export async function updateSalonPaymentMethods(
  salonId: string,
  paymentMethods: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salons")
    .update({ payment_methods: paymentMethods })
    .eq("id", salonId);

  if (error) throw error;
}

export async function upsertBusinessHours(rows: UpsertBusinessHourRow[]): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("salon_business_hours")
    .upsert(rows, { onConflict: "salon_id,day_of_week" });

  if (error) throw error;
}
