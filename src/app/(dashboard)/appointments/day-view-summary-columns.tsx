import Link from "next/link";
import { CheckCircle2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatTimeTz } from "@/infra/format/dates";
import { formatCurrency, toAmount } from "@/infra/format/money";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DataTableColumn } from "@/components/ui/data-table";
import type { CalendarAppointment } from "@/features/appointments/view-models";
import { appointmentStatusPresentation } from "./appointment-status";
import { isClosedStatus } from "@/features/appointments/domain/lifecycle";

function formatAppointmentDayTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

export interface SummaryActions {
  openActionsId: string | null;
  onToggleActions: (appt: CalendarAppointment) => void;
  onComplete: (appt: CalendarAppointment) => void;
  onCancel: (appt: CalendarAppointment) => void;
}

function WhenCell({ appt, tz }: { appt: CalendarAppointment; tz: string }) {
  return (
    <>
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
    </>
  );
}

function ActionsCell({
  appt,
  actionsOpen,
  actions,
}: {
  appt: CalendarAppointment;
  actionsOpen: boolean;
  actions: SummaryActions;
}) {
  return (
    <div className="relative flex items-center justify-end gap-2.5">
      <button
        type="button"
        onClick={() => actions.onComplete(appt)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-success-border bg-success-subtle px-3 text-xs font-semibold text-success-fg transition-colors hover:bg-success-subtle focus:outline-none focus:ring-2 focus:ring-success"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Completar
      </button>
      <button
        type="button"
        onClick={() => actions.onToggleActions(appt)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-label="Abrir acciones de cita"
        aria-expanded={actionsOpen}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {actionsOpen && (
        <div className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-popover">
          <Link
            href={`/appointments/${appt.id}/edit`}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-fg-secondary transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
          </Link>
          <button
            type="button"
            onClick={() => actions.onCancel(appt)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-danger-strong transition-colors hover:bg-danger-subtle"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

/** Columnas del resumen de citas para DataTable (el orden define el móvil: nombre, luego datos secundarios). */
export function buildSummaryColumns(
  tz: string,
  canManage: boolean,
  actions: SummaryActions,
): DataTableColumn<CalendarAppointment>[] {
  return [
    {
      id: "customer",
      header: "Cliente",
      cell: (appt) => (
        <>
          <p className="text-sm font-semibold text-fg-secondary">
            {appt.customer?.first_name} {appt.customer?.last_name}
          </p>
          {appt.customer?.phone && <p className="text-xs text-fg-subtle">{appt.customer.phone}</p>}
        </>
      ),
    },
    {
      id: "when",
      header: "Fecha y hora",
      secondary: true,
      cell: (appt) => <WhenCell appt={appt} tz={tz} />,
    },
    {
      id: "status",
      header: "Estado",
      secondary: true,
      cell: (appt) => <StatusBadge {...appointmentStatusPresentation(appt.status)} />,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      cell: (appt) => (
        <span className="text-sm font-semibold text-fg-secondary">
          {formatCurrency(toAmount(appt.total_price))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      align: "right",
      cell: (appt) => {
        const manageable = canManage && !isClosedStatus(appt.status);
        return manageable ? (
          <ActionsCell appt={appt} actionsOpen={actions.openActionsId === appt.id} actions={actions} />
        ) : null;
      },
    },
  ];
}
