import Link from "next/link";
import { CheckCircle2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatTimeTz } from "@/infra/format/dates";
import { cn } from "@/components/ui/cn";
import type { CalendarAppointment } from "@/features/appointments/view-models";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada",
  cancelled: "Cancelada", no_show: "No asistió",
};
const STATUS_ROW_BG: Record<string, string> = {
  completed: "bg-success-subtle/40", cancelled: "opacity-50", no_show: "bg-warning-subtle/40",
};
const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-info-subtle text-info-fg border-info-border",
  confirmed: "bg-brand-50 text-brand-700 border-brand-200",
  completed: "bg-success-subtle text-success-fg border-success-border",
  cancelled: "bg-surface-sunken text-fg-muted border-border",
  no_show: "bg-warning-subtle text-warning-fg border-warning-border",
};

function formatAppointmentDayTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function SummaryRow({
  appt, tz, canManage, actionsOpen, onToggleActions, onComplete, onCancel,
}: {
  appt: CalendarAppointment;
  tz: string;
  canManage: boolean;
  actionsOpen: boolean;
  onToggleActions: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const manageable = canManage && !["completed", "cancelled", "no_show"].includes(appt.status);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted/60",
        STATUS_ROW_BG[appt.status] ?? ""
      )}
    >
      <div className="w-32 shrink-0">
        {appt.start_time && (
          <>
            <p className="text-xs font-semibold capitalize text-fg-subtle">
              {formatAppointmentDayTz(new Date(appt.start_time), tz)}
            </p>
            <p className="text-xs text-fg-subtle tabular-nums">
              {formatTimeTz(new Date(appt.start_time), tz)}
            </p>
          </>
        )}
        {appt.end_time && (
          <p className="text-xs text-fg-subtle tabular-nums">
            – {formatTimeTz(new Date(appt.end_time), tz)}
          </p>
        )}
      </div>

      <div className="min-w-[140px] flex-1">
        <p className="text-sm font-semibold text-fg-secondary">
          {appt.customer?.first_name} {appt.customer?.last_name}
        </p>
        {appt.customer?.phone && (
          <p className="text-xs text-fg-subtle">{appt.customer.phone}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[appt.status] ?? ""}`}>
          {STATUS_LABEL[appt.status]}
        </span>
        <span className="text-sm font-semibold text-fg-secondary">
          {formatCurrency(Number(appt.total_price ?? 0))}
        </span>
      </div>

      {manageable && (
        <div className="relative ml-2 flex shrink-0 items-center gap-2.5">
          <button
            onClick={onComplete}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-success-border bg-success-subtle px-3 text-xs font-semibold text-success-fg transition-colors hover:bg-success-subtle focus:outline-none focus:ring-2 focus:ring-success"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Completar
          </button>
          <button
            type="button"
            onClick={onToggleActions}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Abrir acciones de cita"
            aria-expanded={actionsOpen}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {actionsOpen && (
            <div className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-popover">
              <Link
                href={`/appointments/${appt.id}/edit`}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-fg-secondary transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <button
                type="button"
                onClick={onCancel}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-danger-strong transition-colors hover:bg-danger-subtle"
              >
                <Trash2 className="h-4 w-4" /> Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
