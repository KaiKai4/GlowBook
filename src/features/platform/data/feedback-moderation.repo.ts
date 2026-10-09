import "server-only";
import { createSupabaseAdminClient } from "@/infra/supabase/admin";
import type { Database } from "@/types/database.types";

export interface FeedbackReportRow {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  salon: { name: string } | null;
  reporter: { full_name: string } | null;
}

export async function findFeedbackReports(): Promise<FeedbackReportRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("feedback_reports")
    .select("id, category, message, status, created_at, salon:salons(name), reporter:profiles(full_name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FeedbackReportRow[];
}

export async function setFeedbackStatus(id: string, status: "new" | "resolved"): Promise<void> {
  const admin = createSupabaseAdminClient();
  const update: Database["public"]["Tables"]["feedback_reports"]["Update"] = { status };
  const { error } = await admin.from("feedback_reports").update(update).eq("id", id);
  if (error) throw error;
}
