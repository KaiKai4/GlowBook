import { MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/lib/auth/session";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getTemplateSettings } from "@/features/notifications/use-cases/get-template-settings";
import { TemplatesManager } from "./templates-manager";

export default async function PlantillasPage() {
  const profile = await requireProfile();
  const templatesEnabled = await isEffectiveSalonModuleEnabled(profile, "plantillas");

  if (!templatesEnabled || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para editar plantillas.</p>
      </div>
    );
  }

  const { templates } = await getTemplateSettings(profile.salon_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <MessageSquareText className="h-6 w-6 text-brand-500" aria-hidden="true" />
            Plantillas
          </span>
        }
        description="Personaliza los mensajes de WhatsApp usados en recordatorios y cancelaciones."
      />

      <TemplatesManager templates={templates} />
    </div>
  );
}
