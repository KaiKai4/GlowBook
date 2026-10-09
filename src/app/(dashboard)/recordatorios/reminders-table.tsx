import { Bell } from "lucide-react";
import type { ReminderAppointment } from "@/features/reminders/view-models";
import { ReminderRow } from "./reminder-row";
import type { ReminderActions } from "./use-reminder-actions";

const HEADERS = ["Cliente", "Profesional", "Servicios", "Fecha", "Recordatorio", "Acciones"];

interface RemindersTableProps {
  rows: ReminderAppointment[];
  tz: string;
  today: string;
  actions: ReminderActions;
}

export function RemindersTable({ rows, tz, today, actions }: RemindersTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-soft overflow-visible">
      {rows.length === 0 ? (
        <div className="py-16 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-fg-disabled" />
          <p className="text-sm text-fg-subtle">Sin citas para estos filtros.</p>
        </div>
      ) : (
        <div className="overflow-x-auto lg:overflow-visible">
          <table className="w-full min-w-[920px] lg:min-w-0 text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                {HEADERS.map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((appt) => (
                <ReminderRow key={appt.id} appt={appt} tz={tz} today={today} actions={actions} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
