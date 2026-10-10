import { formatWeekdayDayMonth } from "@/infra/format/es-formats";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatTimeTz } from "@/infra/format/dates";
import type { ReminderAppointment } from "@/features/reminders";
import { collaboratorNames, customerName, formatSentAt } from "./reminder-format";
import type { ReminderRowState } from "@/features/reminders/domain/reminder-rules";

export function ReminderCustomerCell({ appt }: { appt: ReminderAppointment }) {
  return (
    <>
      <p className="font-semibold text-fg-secondary">{customerName(appt)}</p>
      {appt.customer?.phone && <p className="mt-0.5 text-xs text-fg-subtle">{appt.customer.phone}</p>}
    </>
  );
}

export function ReminderEmployeesCell({ appt }: { appt: ReminderAppointment }) {
  return <span className="text-fg-secondary">{collaboratorNames(appt) || "-"}</span>;
}

export function ReminderServicesCell({ appt }: { appt: ReminderAppointment }) {
  return (
    <div className="flex flex-wrap gap-1">
      {appt.items.map((item) => item.service && (
        <span key={item.id} className="rounded-full border border-choco-100 bg-choco-50 px-2 py-0.5 text-xs font-medium text-choco-700">
          {item.service.name}
        </span>
      ))}
    </div>
  );
}

export function ReminderDateCell({ appt, tz }: { appt: ReminderAppointment; tz: string }) {
  if (!appt.start_time) return <span>-</span>;
  const startTime = new Date(appt.start_time);

  return (
    <span className="block whitespace-nowrap">
      <span className="block font-semibold text-brand-700">{formatTimeTz(startTime, tz)}</span>
      <span className="mt-0.5 block text-xs capitalize text-fg-subtle">
        {formatWeekdayDayMonth(startTime, { weekday: "short", month: "short", timeZone: tz })}
      </span>
    </span>
  );
}

// Estado del recordatorio: pendiente, o enviado hoy / enviado con la fecha del último envío.
export function ReminderStatusCell({ state, tz }: { state: ReminderRowState; tz: string }) {
  if (!state.sentAt) return <StatusBadge variant="warning" label="Pendiente" />;

  return (
    <div className="space-y-1">
      <StatusBadge
        variant={state.sentToday ? "success" : "neutral"}
        label={state.sentToday ? "Enviado hoy" : "Enviado"}
      />
      <p className="text-xs text-fg-subtle">{formatSentAt(state.sentAt, tz)}</p>
    </div>
  );
}
