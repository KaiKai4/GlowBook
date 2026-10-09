import { getReminderQueue } from "@/features/reminders/use-cases/get-reminder-queue";
import { isEffectiveSalonModuleEnabled } from "@/features/billing/use-cases/commercial-plans";
import { hasPermission, PERMISSIONS } from "@/infra/auth/permissions";
import { requireProfile } from "@/infra/auth/session";
import { Bell } from "lucide-react";
import { RemindersView } from "./reminders-view";

export default async function RecordatoriosPage() {
  const profile = await requireProfile();
  const remindersEnabled = await isEffectiveSalonModuleEnabled(profile, "recordatorios");

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
      <div>
        <h1 className="text-2xl font-semibold text-fg flex items-center gap-2">
          <Bell className="h-6 w-6 text-brand-500" />
          Recordatorios
        </h1>
        <p className="text-sm text-fg-subtle mt-0.5">
          Envia recordatorios de citas de los próximos 7 días.
        </p>
      </div>

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
