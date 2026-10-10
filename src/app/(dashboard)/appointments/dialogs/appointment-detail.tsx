"use client";

import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { canEditSchedule } from "@/features/appointments/domain/lifecycle";
import { appointmentStatusPresentation } from "../appointment-status";
import { CheckCheck, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import {
  type ApptForDetail,
  ClientCard,
  ITEM_ACCENT,
  ServiceItemsList,
  TotalsBox,
} from "./appointment-detail-sections";
import { useAppointmentConfirm } from "./use-appointment-confirm";

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
  const { confirming, handleConfirm } = useAppointmentConfirm(appt.id, onClose);

  const customerName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : "Cliente desconocido";

  const accentClass = ITEM_ACCENT[appt.status] ?? "border-l-border-strong";
  const canEdit = canManage && canEditSchedule(appt.status);
  const subtotal = appt.items.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
  const discountAmount = Number(appt.discount_amount ?? 0);
  const whatsappPhone = appt.customer?.phone?.replace(/\D/g, "") ?? "";

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

        <ClientCard
          customerName={customerName}
          phone={appt.customer?.phone}
          whatsappPhone={whatsappPhone}
        />

        <ServiceItemsList items={appt.items} accentClass={accentClass} tz={tz} />

        <TotalsBox
          subtotal={subtotal}
          discountAmount={discountAmount}
          totalPrice={appt.total_price}
          completionNote={appt.completion_price_note}
        />

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
