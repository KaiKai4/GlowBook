import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  type MessageTemplate,
  type NotificationTemplateEvent,
} from "../domain/templates";

type TemplateRow = Database["public"]["Tables"]["notification_templates"]["Row"];

const EVENTS: NotificationTemplateEvent[] = ["appointment_reminder", "appointment_cancelled"];

function toMessageTemplate(row: TemplateRow): MessageTemplate {
  return {
    id: row.id,
    event: row.event as NotificationTemplateEvent,
    name: row.name,
    body_text: row.body_text,
    is_active: row.is_active,
  };
}

export async function findMessageTemplates(salonId: string): Promise<MessageTemplate[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_templates")
    .select("id, event, name, body_text, is_active")
    .eq("salon_id", salonId)
    .eq("channel", "whatsapp")
    .eq("recipient", "customer")
    .in("event", EVENTS)
    .order("event", { ascending: true });

  if (error) throw error;

  const byEvent = new Map(
    (data ?? []).map((row) => [row.event as NotificationTemplateEvent, toMessageTemplate(row as TemplateRow)])
  );

  return EVENTS.map((event) => byEvent.get(event) ?? DEFAULT_MESSAGE_TEMPLATES[event]);
}

export async function findActiveMessageTemplate(
  salonId: string,
  event: NotificationTemplateEvent
): Promise<MessageTemplate> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_templates")
    .select("id, event, name, body_text, is_active")
    .eq("salon_id", salonId)
    .eq("channel", "whatsapp")
    .eq("recipient", "customer")
    .eq("event", event)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toMessageTemplate(data as TemplateRow) : DEFAULT_MESSAGE_TEMPLATES[event];
}

export async function upsertMessageTemplate(
  salonId: string,
  template: MessageTemplate
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const defaultTemplate = DEFAULT_MESSAGE_TEMPLATES[template.event];
  const payload: Database["public"]["Tables"]["notification_templates"]["Insert"] = {
    salon_id: salonId,
    channel: "whatsapp",
    event: template.event,
    recipient: "customer",
    name: defaultTemplate.name,
    subject: "",
    body_text: template.body_text,
    body_html: "",
    is_active: template.is_active,
  };

  const { error } = await supabase
    .from("notification_templates")
    .upsert(payload, { onConflict: "salon_id,channel,event,name" });

  if (error) throw error;
}
