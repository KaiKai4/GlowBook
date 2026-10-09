import "server-only";
import { createSupabaseServerClient } from "@/infra/supabase/server";
import type { FeedbackCategory } from "../schemas";

// Tenant-side write: RLS pins the row to the caller's salon + identity.
export async function createFeedbackReport(input: {
  salonId: string;
  createdBy: string;
  category: FeedbackCategory;
  message: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("feedback_reports").insert({
    salon_id: input.salonId,
    created_by: input.createdBy,
    category: input.category,
    message: input.message,
  });
  if (error) throw error;
}
