import { MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireProfile } from "@/app/_composition/request-context";
import { isEffectiveSalonModuleEnabled, salonModuleScopeFromProfile } from "@/features/billing";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { getTemplateSettings } from "@/features/notifications";
import { TemplatesManager } from "./templates-manager";

export default async function PlantillasPage() {
  const profile = await requireProfile();
  const templatesEnabled = await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "plantillas");

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
