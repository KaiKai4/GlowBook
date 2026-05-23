"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cancelAppointmentAction, deactivateCustomerAction } from "../actions";
import { MessageCircle, UserX, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ApptForCancel {
  id: string;
  start_time: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
}

type ClientAction = "keep" | "permanent";

const CANCEL_TEMPLATE = (name: string, time: string) =>
  `Hola ${name}, lamentamos informarte que tu cita para el ${time} ha sido cancelada. Contáctanos para reagendar. ¡Gracias por tu comprensión!`;

function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function CancelAppointmentDialog({
  appt, open, onClose,
}: {
  appt: ApptForCancel;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [clientAction, setClientAction] = useState<ClientAction>("keep");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const customerName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : "el cliente";

  const apptTime = appt.start_time
    ? new Date(appt.start_time).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" })
    : "la cita";

  function handleCancel(withWhatsApp: boolean) {
    setError(null);
    start(async () => {
      const res = await cancelAppointmentAction(appt.id);
      if (!res.ok) { setError(res.error ?? "Error al cancelar."); return; }

      // If keeping only for history → deactivate customer
      if (clientAction === "keep" && appt.customer?.id) {
        await deactivateCustomerAction(appt.customer.id);
      }

      if (withWhatsApp && appt.customer?.phone) {
        const msg = CANCEL_TEMPLATE(appt.customer.first_name, apptTime);
        window.open(buildWhatsAppUrl(appt.customer.phone, msg), "_blank");
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cancelar cita"
      description={`Confirma la cancelación de la cita de ${customerName}.`}
      className="max-w-md"
    >
      <div className="space-y-5">
        {/* Client disposition */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">¿Qué hacemos con este cliente?</p>
          <p className="text-xs text-amber-700">
            La cita puede cancelarse sin eliminar al cliente de la base de datos.
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setClientAction("keep")}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all",
                clientAction === "keep"
                  ? "border-amber-400 bg-white"
                  : "border-transparent bg-white/60 hover:bg-white"
              )}
            >
              <div className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                clientAction === "keep" ? "border-amber-500 bg-amber-500" : "border-stone-300"
              )}>
                {clientAction === "keep" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <UserX className="h-3.5 w-3.5 text-amber-600" />
                  <p className="text-sm font-semibold text-stone-800">Solo para historial</p>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  No aparecerá en el buscador de clientes, pero quedará el registro de la cita.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setClientAction("permanent")}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all",
                clientAction === "permanent"
                  ? "border-violet-400 bg-white"
                  : "border-transparent bg-white/60 hover:bg-white"
              )}
            >
              <div className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                clientAction === "permanent" ? "border-violet-500 bg-violet-500" : "border-stone-300"
              )}>
                {clientAction === "permanent" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-violet-600" />
                  <p className="text-sm font-semibold text-stone-800">Convertirlo en cliente permanente</p>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Aparecerá en clientes y podrá reutilizarse en próximas citas.
                </p>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {appt.customer?.phone && (
            <Button
              variant="outline"
              className="w-full border-green-200 text-green-700 hover:bg-green-50"
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
      </div>
    </Dialog>
  );
}
