"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useSubmissionIntent } from "@/components/forms/use-submission-intent";
import { StatusBadge } from "@/components/ui/status-badge";
import { canEditSchedule } from "@/features/appointments/domain/lifecycle";
import { appointmentStatusPresentation } from "../appointment-status";
import { formatCurrency, formatTimeTz } from "@/infra/format/dates";
import {
  CheckCheck,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Pencil,
  Phone,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import { confirmAppointmentAction } from "../actions";

interface ApptItem {
  id: string;
  start_time: string;
  end_time: string;
  price: number;
  discount_amount?: number;
  service: { name: string; duration_minutes: number } | null;
  employee: { first_name: string; last_name: string } | null;
}

interface ApptForDetail {
  id: string; status: string;
  start_time: string | null; end_time: string | null;
  total_price: number | string | null;
  discount_amount?: number | string | null;
  completion_price_note?: string | null;
  notes: string | null;
  customer: { first_name: string; last_name: string; phone: string | null } | null;
  items: ApptItem[];
}

const ITEM_ACCENT: Record<string, string> = {
  scheduled: "border-l-info",
  confirmed: "border-l-brand-500",
  completed: "border-l-success",
  no_show: "border-l-warning",
};

export function AppointmentDetailDialog({
  appt, tz, open, onClose, canManage, onComplete, onCancel,
}: {
  appt: ApptForDetail;
  tz: string;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  /** Abre el flujo de cobro existente (cierra este detalle primero). */
  onComplete?: () => void;
  /** Abre el flujo de cancelación existente (cierra este detalle primero). */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, startConfirm] = useTransition();
  const { submit } = useSubmissionIntent({ procedure: "appointments.confirm" });

  const customerName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : "Cliente desconocido";

  const accentClass = ITEM_ACCENT[appt.status] ?? "border-l-border-strong";
  const canEdit = canManage && canEditSchedule(appt.status);
  const subtotal = appt.items.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
  const discountAmount = Number(appt.discount_amount ?? 0);
  const whatsappPhone = appt.customer?.phone?.replace(/\D/g, "") ?? "";

  function handleConfirm() {
    startConfirm(async () => {
      const res = await submit({ appointment_id: appt.id }, (idempotencyKey) => {
        const fd = new FormData();
        fd.set("idempotency_key", idempotencyKey);
        fd.set("appointment_id", appt.id);
        return confirmAppointmentAction(fd);
      });
      if (res.ok) {
        toast.success("Cita confirmada.");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error ?? "No se pudo confirmar la cita.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detalles de la cita"
      className="max-w-md"
      dismissible={!confirming}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge {...appointmentStatusPresentation(appt.status)} />
          {canEdit && (
            <Link
              href={`/appointments/${appt.id}/edit`}
              className={buttonVariants({
                variant: "primary",
                size: "sm",
                className: "h-9 px-3.5 shadow-sm",
              })}
            >
              <Pencil className="h-4 w-4" />
              Editar / reprogramar
            </Link>
          )}
        </div>

        {/* Cliente */}
        <div className="flex items-start gap-3 rounded-xl bg-brand-50 border border-brand-200 p-3 shadow-brand-soft">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 shrink-0">
            <User className="h-4 w-4 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-brand-500 font-semibold">Cliente</p>
            <p className="text-sm font-semibold text-fg-secondary">{customerName}</p>
            {appt.customer?.phone && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3 text-fg-subtle" />
                <p className="text-xs text-fg-muted">{appt.customer.phone}</p>
              </div>
            )}
          </div>
          {whatsappPhone && (
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Contactar por WhatsApp"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-fg transition-colors hover:bg-success-border"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Servicios — cada uno como card elevada */}
        <div className="space-y-2.5">
          {appt.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-xl bg-surface border border-border border-l-4 ${accentClass} px-4 py-3 shadow-soft hover:shadow-hover transition-shadow`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg-secondary truncate">{item.service?.name}</p>
                <p className="text-xs text-fg-subtle mt-0.5 flex items-center gap-1.5">
                  <span>{item.employee?.first_name} {item.employee?.last_name}</span>
                  <span className="text-fg-disabled">·</span>
                  <span className="text-brand-600 font-medium tabular-nums">
                    {formatTimeTz(new Date(item.start_time), tz)}–{formatTimeTz(new Date(item.end_time), tz)}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                {Number(item.discount_amount ?? 0) > 0 && (
                  <span className="text-xs font-semibold text-success-fg">
                    -{formatCurrency(Number(item.discount_amount ?? 0))}
                  </span>
                )}
                <span className="text-sm font-semibold text-fg-secondary">
                  {formatCurrency(
                    Math.max(0, Number(item.price) - Number(item.discount_amount ?? 0))
                  )}
                </span>
                <span className="flex items-center gap-0.5 text-xs text-fg-subtle font-medium">
                  <Timer className="h-3 w-3" />
                  {item.service?.duration_minutes} min
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="rounded-xl border border-success-border bg-success-subtle px-4 py-3 shadow-success-soft">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-success-strong/70">
              <span>Subtotal servicios</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-success-fg">
                <span>Descuento</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-success-border pt-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-success-fg" />
                <span className="text-sm font-semibold text-success-strong">Total cobrado</span>
              </div>
              <span className="text-lg font-semibold text-success-strong">
                {formatCurrency(Number(appt.total_price ?? 0))}
              </span>
            </div>
          </div>
          {appt.completion_price_note && (
            <div className="mt-3 rounded-lg bg-surface/70 px-3 py-2">
              <p className="text-xs font-semibold text-success-fg">Nota de cobro</p>
              <p className="mt-1 text-sm text-success-strong">{appt.completion_price_note}</p>
            </div>
          )}
        </div>

        {/* Notas */}
        {appt.notes && (
          <div className="rounded-xl bg-surface-muted border border-border px-4 py-3">
            <p className="text-xs font-semibold text-fg-subtle mb-1">Notas</p>
            <p className="text-sm text-fg-secondary">{appt.notes}</p>
          </div>
        )}

        {/* Acciones rápidas: el camino corto desde el calendario sin pasar
            por el resumen ni por la edición completa. */}
        {canEdit && (
          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            {appt.status === "scheduled" && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                loading={confirming}
                onClick={handleConfirm}
              >
                <CheckCheck className="h-4 w-4" />
                Confirmar
              </Button>
            )}
            {onComplete && (
              <Button
                variant="primary"
                size="sm"
                className="flex-1 bg-success-solid hover:bg-success-solid"
                disabled={confirming}
                onClick={onComplete}
              >
                <CheckCircle2 className="h-4 w-4" />
                Completar
              </Button>
            )}
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-danger-strong hover:bg-danger-subtle hover:text-danger-strong"
                disabled={confirming}
                onClick={onCancel}
              >
                <Trash2 className="h-4 w-4" />
                Cancelar cita
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
