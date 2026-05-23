"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { Button } from "@/components/ui/button";
import { AppointmentsCalendar } from "./appointments-calendar";
import { AppointmentDetailDialog } from "./dialogs/appointment-detail";
import { CompleteAppointmentDialog } from "./dialogs/complete-appointment";
import { CancelAppointmentDialog } from "./dialogs/cancel-appointment";
import { confirmAppointmentAction } from "./actions";
import { cn } from "@/lib/utils/cn";
import { CheckCircle2, XCircle, ThumbsUp, Eye, ListFilter } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada",
  cancelled: "Cancelada", no_show: "No asistió",
};
const STATUS_ROW_BG: Record<string, string> = {
  completed: "bg-emerald-50/40",
  cancelled: "opacity-50",
  no_show: "bg-amber-50/40",
};
const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-stone-100 text-stone-500 border-stone-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
};

export interface ApptFull {
  id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  total_price: string | null;
  notes: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  items: Array<{
    id: string;
    start_time: string;
    end_time: string;
    price: number;
    service: { id: string; name: string; duration_minutes: number } | null;
    employee: { id: string; first_name: string; last_name: string } | null;
  }>;
}

export function AppointmentsDayView({
  appointments,
  tz,
  canManage,
}: {
  appointments: ApptFull[];
  tz: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startConfirm] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const [detailAppt, setDetailAppt] = useState<ApptFull | null>(null);
  const [completeAppt, setCompleteAppt] = useState<ApptFull | null>(null);
  const [cancelAppt, setCancelAppt] = useState<ApptFull | null>(null);

  function handleConfirm(apptId: string) {
    setConfirmingId(apptId);
    startConfirm(async () => {
      await confirmAppointmentAction(apptId);
      setConfirmingId(null);
      router.refresh();
    });
  }

  const listAppts = filterStatus
    ? appointments.filter((a) => a.status === filterStatus)
    : appointments;

  const statusFilters = [
    { value: null, label: "Todas" },
    { value: "scheduled", label: "Agendadas" },
    { value: "confirmed", label: "Confirmadas" },
    { value: "completed", label: "Completadas" },
    { value: "cancelled", label: "Canceladas" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Calendario ─────────────────────────────────────── */}
      <AppointmentsCalendar
        appointments={appointments}
        tz={tz}
        onApptClick={(a) => setDetailAppt(a as ApptFull)}
      />

      {/* ── Lista de citas ──────────────────────────────────── */}
      <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-violet-50 bg-gradient-to-r from-choco-50 to-white">
          <h2 className="text-sm font-bold text-choco-700 uppercase tracking-wide">
            <ListFilter className="inline h-3.5 w-3.5 mr-1" />
            Resumen de citas
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusFilters.map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setFilterStatus(f.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filterStatus === f.value
                    ? "border-violet-400 bg-violet-50 text-violet-700"
                    : "border-stone-200 text-stone-500 hover:bg-stone-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {listAppts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-stone-400">No hay citas para este filtro.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {listAppts.map((appt) => (
              <div
                key={appt.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-stone-50/60",
                  STATUS_ROW_BG[appt.status] ?? ""
                )}
              >
                {/* Time */}
                <div className="w-24 shrink-0">
                  {appt.start_time && (
                    <p className="text-sm font-bold text-violet-700 tabular-nums">
                      {formatTimeTz(new Date(appt.start_time), tz)}
                    </p>
                  )}
                  {appt.end_time && (
                    <p className="text-xs text-stone-400 tabular-nums">
                      – {formatTimeTz(new Date(appt.end_time), tz)}
                    </p>
                  )}
                </div>

                {/* Cliente */}
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-semibold text-stone-800">
                    {appt.customer?.first_name} {appt.customer?.last_name}
                  </p>
                  {appt.customer?.phone && (
                    <p className="text-xs text-stone-400">{appt.customer.phone}</p>
                  )}
                </div>

                {/* Servicios */}
                <div className="flex-1 min-w-[160px]">
                  <div className="flex flex-wrap gap-1">
                    {appt.items.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-choco-50 border border-choco-100 px-2 py-0.5 text-[11px] text-choco-600 font-medium"
                      >
                        {item.service?.name} · {item.employee?.first_name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status + total */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[appt.status] ?? ""}`}>
                    {STATUS_LABEL[appt.status]}
                  </span>
                  <span className="text-sm font-bold text-stone-700">
                    {formatCurrency(Number(appt.total_price ?? 0))}
                  </span>
                </div>

                {/* Actions */}
                {canManage && !["completed", "cancelled", "no_show"].includes(appt.status) && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setDetailAppt(appt)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:bg-stone-50 hover:text-stone-700 transition-colors"
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {appt.status === "scheduled" && (
                      <button
                        onClick={() => handleConfirm(appt.id)}
                        disabled={pending && confirmingId === appt.id}
                        className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        title="Confirmar"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> Confirmar
                      </button>
                    )}

                    <button
                      onClick={() => setCompleteAppt(appt)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                      title="Completar"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completar
                    </button>

                    <button
                      onClick={() => setCancelAppt(appt)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                      title="Cancelar"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────── */}
      {detailAppt && (
        <AppointmentDetailDialog
          appt={detailAppt}
          tz={tz}
          open={!!detailAppt}
          onClose={() => setDetailAppt(null)}
        />
      )}
      {completeAppt && (
        <CompleteAppointmentDialog
          appt={completeAppt}
          open={!!completeAppt}
          onClose={() => setCompleteAppt(null)}
        />
      )}
      {cancelAppt && (
        <CancelAppointmentDialog
          appt={cancelAppt}
          open={!!cancelAppt}
          onClose={() => setCancelAppt(null)}
        />
      )}
    </div>
  );
}
