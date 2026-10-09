import { Clock } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { formatTimeTz } from "@/infra/format/dates";
import type { ReminderAppointment } from "@/features/reminders/view-models";
import { collaboratorNames, customerName, formatSentAt } from "./reminder-format";
import { reminderRowState } from "./reminder-rules";
import { ReminderRowActions } from "./reminder-row-actions";
import type { ReminderActions } from "./use-reminder-actions";

interface ReminderRowProps {
  appt: ReminderAppointment;
  tz: string;
  today: string;
  actions: ReminderActions;
}

function ReminderSentBadge({ sentAt, sentToday, tz }: { sentAt: string; sentToday: boolean; tz: string }) {
  return (
    <div className="space-y-1">
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        sentToday
          ? "border-success-border bg-success-subtle text-success-fg"
          : "border-border bg-surface-muted text-fg-muted"
      )}>
        <Clock className="h-3 w-3" />
        {sentToday ? "Enviado hoy" : "Enviado"}
      </span>
      <p className="text-xs text-fg-subtle">{formatSentAt(sentAt, tz)}</p>
    </div>
  );
}

function AppointmentDate({ startTime, tz }: { startTime: string; tz: string }) {
  return (
    <>
      <p className="font-semibold text-brand-700">{formatTimeTz(new Date(startTime), tz)}</p>
      <p className="mt-0.5 text-xs capitalize text-fg-subtle">
        {new Date(startTime).toLocaleDateString("es-PA", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: tz,
        })}
      </p>
    </>
  );
}

// Fila de la tabla de recordatorios: datos de la cita, estado del recordatorio y acciones.
export function ReminderRow({ appt, tz, today, actions }: ReminderRowProps) {
  const confirmBusy = actions.isPending && actions.confirmingId === appt.id;
  const sendBusy = actions.isPending && actions.sendingId === appt.id;
  const row = reminderRowState(appt, actions, today, tz, confirmBusy);
  const employeeNames = collaboratorNames(appt);

  return (
    <tr className="transition-colors hover:bg-surface-muted/60">
      <td className="px-4 py-3">
        <p className="font-semibold text-fg-secondary">{customerName(appt)}</p>
        {appt.customer?.phone && (
          <p className="mt-0.5 text-xs text-fg-subtle">{appt.customer.phone}</p>
        )}
      </td>
      <td className="px-4 py-3 text-fg-secondary">{employeeNames || "-"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {appt.items.map((item) => item.service && (
            <span key={item.id} className="rounded-full border border-choco-100 bg-choco-50 px-2 py-0.5 text-xs font-medium text-choco-700">
              {item.service.name}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {appt.start_time ? <AppointmentDate startTime={appt.start_time} tz={tz} /> : "-"}
      </td>
      <td className="px-4 py-3">
        {row.sentAt ? (
          <ReminderSentBadge sentAt={row.sentAt} sentToday={row.sentToday} tz={tz} />
        ) : (
          <span className="text-xs font-medium text-warning-fg">Pendiente</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ReminderRowActions appt={appt} actions={actions} row={row} sendBusy={sendBusy} confirmBusy={confirmBusy} />
      </td>
    </tr>
  );
}
