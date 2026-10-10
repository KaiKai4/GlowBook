import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";

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
