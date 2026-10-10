"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSubmissionIntent } from "@/components/forms/use-submission-intent";
import { cancelAppointmentAction } from "../actions";
import { MessageCircle, UserX, UserCheck } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { buildWhatsAppUrl, type TemporaryCustomerChoice } from "@/features/appointments/domain/cancellation-message";
import { buildCancellationMessage } from "./cancellation-message";

interface ApptForCancel {
  id: string;
  start_time: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    is_temporary: boolean;
  } | null;
  items?: Array<{
    service: { name: string } | null;
    employee: { first_name: string; last_name: string } | null;
  }>;
}

export function CancelAppointmentDialog({
  appt, open, onClose, tz, salonName, template,
}: {
  appt: ApptForCancel;
  open: boolean;
  onClose: () => void;
  tz: string;
  salonName: string;
  template: string;
}) {
  const router = useRouter();
  const { submit } = useSubmissionIntent({ procedure: "appointments.cancel" });
  const isTemp = appt.customer?.is_temporary ?? false;
  const [saveChoice, setSaveChoice] = useState<TemporaryCustomerChoice>(isTemp ? "discard" : "save");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Set when the appointment is cancelled but the customer step failed: the dialog
  // stays open so the user reads the warning instead of it being silently lost.
  const [warning, setWarning] = useState<string | null>(null);

  const customerName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : "el cliente";

  // La decisión sobre el cliente temporal la aplica el servidor en la misma acción de cancelar.
  // Aquí solo se envía la intención: "keep" para clientes permanentes o citas sin cliente temporal.
  function customerDispositionIntent(): "keep" | "promote" | "discard" {
    if (!isTemp) return "keep";
    return saveChoice === "save" ? "promote" : "discard";
  }

  function handleCancel(withWhatsApp: boolean) {
    setError(null);
    start(async () => {
      const disposition = customerDispositionIntent();
      const result = await submit({ appointment_id: appt.id, customer_disposition: disposition }, (idempotencyKey) => {
        const formData = new FormData();
        formData.set("idempotency_key", idempotencyKey);
        formData.set("appointment_id", appt.id);
        formData.set("customer_disposition", disposition);
        return cancelAppointmentAction(formData);
      });
      if (!result.ok) { setError(result.error ?? "Error al cancelar."); return; }

      if (withWhatsApp && appt.customer?.phone) {
        const msg = buildCancellationMessage({ appt, template, salonName, tz });
        window.open(buildWhatsAppUrl(appt.customer.phone, msg), "_blank", "noopener,noreferrer");
      }

      router.refresh();
      // La cita está cancelada; los avisos son de pasos posteriores (cliente) y se muestran sin cerrar.
      const warnings = result.warnings ?? [];
      if (warnings.length > 0) {
        setWarning(warnings.join(" "));
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cancelar cita"
      description={`Confirma la cancelación de la cita de ${customerName}.`}
      className="max-w-md"
      dismissible={!pending}
    >
      <div className="space-y-5">
        {/* Only show customer disposition when the customer was created just for this appointment */}
        {isTemp && (
          <div className="rounded-xl border border-warning-border bg-warning-subtle p-4 space-y-3">
            <p className="text-sm font-semibold text-warning-strong">
              ¿Guardar los datos del cliente?
            </p>
            <p className="text-xs text-warning-fg">
              Este cliente aún no está registrado. Puedes guardarlo o descartarlo.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSaveChoice("save")}
                className={cn(
                  "w-full flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all",
                  saveChoice === "save"
                    ? "border-brand-400 bg-surface"
                    : "border-transparent bg-surface/60 hover:bg-surface"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  saveChoice === "save" ? "border-brand-500 bg-brand-500" : "border-border-strong"
                )}>
                  {saveChoice === "save" && <div className="h-1.5 w-1.5 rounded-full bg-surface" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-brand-600" />
                    <p className="text-sm font-semibold text-fg-secondary">Sí, guardar cliente</p>
                  </div>
                  <p className="text-xs text-fg-subtle mt-0.5">
                    Quedará registrado y podrá usarse en futuras citas.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSaveChoice("discard")}
                className={cn(
                  "w-full flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all",
                  saveChoice === "discard"
                    ? "border-warning bg-surface"
                    : "border-transparent bg-surface/60 hover:bg-surface"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  saveChoice === "discard" ? "border-warning bg-warning" : "border-border-strong"
                )}>
                  {saveChoice === "discard" && <div className="h-1.5 w-1.5 rounded-full bg-surface" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <UserX className="h-3.5 w-3.5 text-warning-fg" />
                    <p className="text-sm font-semibold text-fg-secondary">No, descartar datos</p>
                  </div>
                  <p className="text-xs text-fg-subtle mt-0.5">
                    No se guardará ningún registro del cliente.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-danger-subtle border border-danger-border px-3 py-2 text-sm text-danger-strong">
            {error}
          </div>
        )}

        {warning && (
          <div role="status" className="rounded-lg bg-warning-subtle border border-warning-border px-3 py-2 text-sm text-warning-strong">
            {warning}
          </div>
        )}

        {warning ? (
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
        <div className="flex flex-col gap-2">
          {appt.customer?.phone && (
            <Button
              variant="outline"
              className="w-full border-success-border text-success-fg hover:bg-success-subtle"
              loading={pending}
              onClick={() => handleCancel(true)}
            >
              <MessageCircle className="h-4 w-4" />
              Cancelar y notificar por WhatsApp
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Volver
            </Button>
            <Button variant="destructive" className="flex-1" loading={pending} onClick={() => handleCancel(false)}>
              Cancelar cita
            </Button>
          </div>
        </div>
        )}
      </div>
    </Dialog>
  );
}
