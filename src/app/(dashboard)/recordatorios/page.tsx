import { getReminderQueue } from "@/features/reminders";
import { isEffectiveSalonModuleEnabled, salonModuleScopeFromProfile } from "@/features/billing";
import { PageHeader } from "@/components/ui/page-header";
import { hasPermission, PERMISSIONS } from "@/features/access";
import { requireProfile } from "@/app/_composition/request-context";
import { Bell } from "lucide-react";
import { RemindersView } from "./reminders-view";

export default async function RecordatoriosPage() {
  const profile = await requireProfile();
  const remindersEnabled = await isEffectiveSalonModuleEnabled(salonModuleScopeFromProfile(profile), "recordatorios");

  if (!remindersEnabled || !hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return (
      <div className="py-16 text-center">
        <p className="text-fg-subtle">No tienes permiso para ver recordatorios.</p>
      </div>
    );
  }

  const reminderQueue = await getReminderQueue({ salonId: profile.salon_id });

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-brand-500" aria-hidden="true" />
            Recordatorios
          </span>
        }
        description="Envia recordatorios de citas de los próximos 7 días."
      />

      <RemindersView
        appointments={reminderQueue.appointments}
        employees={reminderQueue.employees}
        tz={reminderQueue.timezone}
        salonName={reminderQueue.salonName}
        template={reminderQueue.template}
        templateId={reminderQueue.templateId}
      />
    </div>
  );
}
