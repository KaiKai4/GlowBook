import { MessageSquareText } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { findMessageTemplates } from "@/features/notifications/data/notification-templates.repo";
import { TemplatesManager } from "./templates-manager";

export default async function PlantillasPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para editar plantillas.</p>
      </div>
    );
  }

  const templates = await findMessageTemplates(profile.salon_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <MessageSquareText className="h-6 w-6 text-brand-500" />
          Plantillas
        </h1>
        <p className="mt-0.5 text-sm text-stone-500">
          Personaliza los mensajes de WhatsApp usados en recordatorios y cancelaciones.
        </p>
      </div>

      <TemplatesManager templates={templates} />
    </div>
  );
}
