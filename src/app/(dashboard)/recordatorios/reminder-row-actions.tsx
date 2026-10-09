import { CheckCircle2, Clipboard, MessageCircle, MoreHorizontal } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { ReminderAppointment } from "@/features/reminders/view-models";
import type { ReminderRowState } from "./reminder-rules";
import type { ReminderActions } from "./use-reminder-actions";

interface ReminderRowActionsProps {
  appt: ReminderAppointment;
  actions: ReminderActions;
  row: ReminderRowState;
  sendBusy: boolean;
  confirmBusy: boolean;
}

function confirmTitle(row: ReminderRowState): string | undefined {
  if (row.currentStatus === "confirmed") return "La cita ya esta confirmada";
  if (row.hasReminderContact) return undefined;
  return "Copia el mensaje o envialo por WhatsApp antes de confirmar la cita.";
}

function confirmLabel(row: ReminderRowState, confirmBusy: boolean): string {
  if (row.currentStatus === "confirmed") return "Confirmada";
  return confirmBusy ? "Confirmando" : "Confirmar cita";
}

// Acciones de una fila: confirmar la cita y el menú con copiar, WhatsApp y marcar enviado.
export function ReminderRowActions({ appt, actions, row, sendBusy, confirmBusy }: ReminderRowActionsProps) {
  const menuOpen = actions.openActionsId === appt.id;
  const copied = actions.copiedId === appt.id;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => actions.confirmAppointment(appt)}
        disabled={row.currentStatus === "confirmed" || !row.canConfirm}
        title={confirmTitle(row)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed",
          row.currentStatus === "confirmed"
            ? "border-success-border bg-success-subtle text-success-fg"
            : row.canConfirm
              ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
              : "border-border bg-surface-muted text-fg-disabled"
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {confirmLabel(row, confirmBusy)}
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => actions.setOpenActionsId(menuOpen ? null : appt.id)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Abrir acciones del recordatorio"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-popover">
            <button
              type="button"
              onClick={() => {
                actions.setOpenActionsId(null);
                actions.copyMessage(appt);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-fg-secondary transition-colors hover:bg-surface-muted"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-success-fg" /> : <Clipboard className="h-4 w-4" />}
              {copied ? "Mensaje copiado" : "Copiar mensaje"}
            </button>
            <button
              type="button"
              onClick={() => {
                actions.setOpenActionsId(null);
                actions.openWhatsApp(appt);
              }}
              disabled={!row.hasPhone || row.sentToday}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:text-fg-disabled",
                row.hasPhone && !row.sentToday ? "text-success-fg hover:bg-success-subtle" : "text-fg-disabled"
              )}
            >
              <MessageCircle className="h-4 w-4" />
              Enviar por WhatsApp
            </button>
            <button
              type="button"
              onClick={() => {
                actions.setOpenActionsId(null);
                actions.markAsSent(appt);
              }}
              disabled={row.sentToday || sendBusy}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-fg-disabled"
            >
              <CheckCircle2 className="h-4 w-4" />
              {row.sentToday ? "Recordatorio enviado" : sendBusy ? "Guardando" : "Marcar recordatorio enviado"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
