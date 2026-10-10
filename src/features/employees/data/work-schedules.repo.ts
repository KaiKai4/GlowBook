import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { Database } from "@/types/database.types";

// Horarios semanales de colaborador (tabla work_schedules), siempre dentro del salón.

export async function upsertWorkSchedule(
  salonId: string,
  schedule: Omit<Database["public"]["Tables"]["work_schedules"]["Insert"], "salon_id">
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("work_schedules")
    .upsert({ ...schedule, salon_id: salonId }, { onConflict: "salon_id,employee_id,day_of_week,start_time,end_time" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkSchedule(id: string, salonId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("work_schedules")
    .delete()
    .eq("id", id)
    .eq("salon_id", salonId);
  if (error) throw error;
}
