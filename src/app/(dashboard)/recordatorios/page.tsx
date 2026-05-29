import { getReminderQueue } from "@/features/notifications/use-cases/get-reminder-queue";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requireProfile } from "@/lib/auth/session";
import { Bell } from "lucide-react";
import { RemindersView } from "./reminders-view";

export default async function RecordatoriosPage() {
  const profile = await requireProfile();

  if (!hasPermission(profile, PERMISSIONS.REMINDERS_SEND)) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-400">No tienes permiso para ver recordatorios.</p>
      </div>
    );
  }

  const reminderQueue = await getReminderQueue({ salonId: profile.salon_id });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
          <Bell className="h-6 w-6 text-brand-500" />
          Recordatorios
        </h1>
        <p className="text-sm text-stone-400 mt-0.5">
          EnvÃ­a recordatorios de citas de los prÃ³ximos 7 dÃ­as.
        </p>
      </div>

      <RemindersView
        appointments={reminderQueue.appointments}
        employees={reminderQueue.employees}
        tz={reminderQueue.timezone}
        salonName={reminderQueue.salonName}
        template={reminderQueue.template}
      />
    </div>
  );
}
