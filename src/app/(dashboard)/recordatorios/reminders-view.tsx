"use client";

import { useMemo, useState, useTransition } from "react";
import { Bell, CheckCircle2, Clipboard, Clock, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatTimeTz } from "@/lib/utils/dates";
import { renderMessageTemplate } from "@/features/notifications/domain/templates";
import type {
  ReminderAppointment,
  ReminderEmployee,
} from "@/features/reminders/view-models";
import { markReminderSentAction } from "./actions";

type Period = "pendientes_hoy" | "hoy" | "manana" | "48h" | "7dias";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "pendientes_hoy", label: "Pendientes hoy" },
  { value: "hoy", label: "Todas hoy" },
  { value: "manana", label: "Mañana" },
  { value: "48h", label: "Proximas 48 horas" },
  { value: "7dias", label: "Proximos 7 dias" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "scheduled", label: "Agendada" },
  { value: "confirmed", label: "Confirmada" },
];

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-brand-50 text-brand-700 border-brand-200",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
};

function localDateStr(isoStr: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(isoStr));
}

function todayStr(tz: string): string {
  return localDateStr(new Date().toISOString(), tz);
}

function tomorrowStr(tz: string): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDateStr(date.toISOString(), tz);
}

function isSameLocalDay(left: string | null, right: string, tz: string): boolean {
  return !!left && localDateStr(left, tz) === right;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function formatSentAt(sentAt: string, tz: string): string {
  const date = new Date(sentAt);
  return `${date.toLocaleDateString("es-PA", {
    day: "numeric",
    month: "short",
    timeZone: tz,
  })} ${formatTimeTz(date, tz)}`;
}

function buildReminderMessage({
  appt,
  tz,
  salonName,
  template,
}: {
  appt: ReminderAppointment;
  tz: string;
  salonName: string;
  template: string;
}): string {
  const start = appt.start_time ? new Date(appt.start_time) : new Date();
  const dateLabel = start.toLocaleDateString("es-PA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  });
  const services =
    appt.items.map((item) => item.service?.name).filter(Boolean).join(", ") ||
    "Servicios de belleza";
  const collaborators =
    [...new Set(
      appt.items
        .map((item) =>
          item.employee ? `${item.employee.first_name} ${item.employee.last_name}` : null
        )
        .filter(Boolean)
    )].join(", ") || "nuestro equipo";

  return renderMessageTemplate(template, {
    cliente: appt.customer?.first_name ?? "cliente",
    fecha: dateLabel,
    hora: formatTimeTz(start, tz),
    servicios: services,
    colaboradores: collaborators,
    salon: salonName,
  });
}

export function RemindersView({
  appointments,
  employees,
  tz,
  salonName,
  template,
  templateId,
}: {
  appointments: ReminderAppointment[];
  employees: ReminderEmployee[];
  tz: string;
  salonName: string;
  template: string;
  templateId?: string;
}) {
  const [period, setPeriod] = useState<Period>("pendientes_hoy");
  const [empId, setEmpId] = useState("");
  const [status, setStatus] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [manualSentAt, setManualSentAt] = useState<Record<string, string>>({});

  const today = todayStr(tz);
  const pendingTodayCount = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          appt.start_time &&
          localDateStr(appt.start_time, tz) === today &&
          !isSameLocalDay(manualSentAt[appt.id] ?? appt.last_reminder_sent_at, today, tz)
      ).length,
    [appointments, manualSentAt, today, tz]
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const tomorrow = tomorrowStr(tz);
    const cutoff48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    return appointments.filter((appt) => {
      if (!appt.start_time) return false;
      const apptDate = localDateStr(appt.start_time, tz);
      const apptTime = new Date(appt.start_time);
      const lastSentAt = manualSentAt[appt.id] ?? appt.last_reminder_sent_at;

      if (period === "pendientes_hoy") {
        if (apptDate !== today) return false;
        if (isSameLocalDay(lastSentAt, today, tz)) return false;
      }
      if (period === "hoy" && apptDate !== today) return false;
      if (period === "manana" && apptDate !== tomorrow) return false;
      if (period === "48h" && apptTime > cutoff48) return false;

      if (empId && !appt.items.some((item) => item.employee?.id === empId)) return false;
      if (status && appt.status !== status) return false;

      return true;
    });
  }, [appointments, empId, manualSentAt, period, status, today, tz]);

  function messageFor(appt: ReminderAppointment): string {
    return buildReminderMessage({ appt, tz, salonName, template });
  }

  async function copyMessage(appt: ReminderAppointment) {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(messageFor(appt));
      setCopiedId(appt.id);
      setTimeout(() => setCopiedId((current) => (current === appt.id ? null : current)), 1800);
    } catch {
      setActionError("No se pudo copiar el mensaje. Revisa permisos del navegador.");
    }
  }

  function openWhatsApp(appt: ReminderAppointment) {
    if (!appt.customer?.phone) return;
    window.open(buildWhatsAppUrl(appt.customer.phone, messageFor(appt)), "_blank");
  }

  function markAsSent(appt: ReminderAppointment) {
    setActionError(null);
    setSendingId(appt.id);

    startTransition(async () => {
      const result = await markReminderSentAction(appt.id, templateId);
      setSendingId(null);

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      setManualSentAt((current) => ({ ...current, [appt.id]: result.value }));
    });
  }

  const selectClass =
    "h-10 rounded-xl border border-stone-200 bg-white px-3 pr-8 text-sm text-stone-700 appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Pendientes de recordar hoy
          </p>
          <p className="mt-2 text-3xl font-bold text-brand-900">{pendingTodayCount}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            En la vista actual
          </p>
          <p className="mt-2 text-3xl font-bold text-stone-900">{filtered.length}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Ventana operativa
          </p>
          <p className="mt-2 text-sm font-semibold text-stone-800">Hoy a proximos 7 dias</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-stone-500">Vista</label>
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className={selectClass}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-stone-500">Profesional</label>
          <select value={empId} onChange={(event) => setEmpId(event.target.value)} className={selectClass}>
            <option value="">Todos los colaboradores</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-stone-500">Estado</label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {actionError}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-stone-200" />
            <p className="text-sm text-stone-400">Sin citas para estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {["Cliente", "Profesional", "Servicios", "Fecha", "Estado", "Recordatorio", "Acciones"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((appt) => {
                  const customerName = appt.customer
                    ? `${appt.customer.first_name} ${appt.customer.last_name}`
                    : "Sin cliente";
                  const employeeNames = [...new Set(
                    appt.items
                      .map((item) =>
                        item.employee ? `${item.employee.first_name} ${item.employee.last_name}` : null
                      )
                      .filter(Boolean)
                  )].join(", ");
                  const sentAt = manualSentAt[appt.id] ?? appt.last_reminder_sent_at;
                  const sentToday = isSameLocalDay(sentAt, today, tz);
                  const hasPhone = !!appt.customer?.phone;

                  return (
                    <tr key={appt.id} className="transition-colors hover:bg-stone-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-800">{customerName}</p>
                        {appt.customer?.phone && (
                          <p className="mt-0.5 text-xs text-stone-400">{appt.customer.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{employeeNames || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {appt.items.map((item) => item.service && (
                            <span key={item.id} className="rounded-full border border-choco-100 bg-choco-50 px-2 py-0.5 text-[11px] font-medium text-choco-700">
                              {item.service.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {appt.start_time ? (
                          <>
                            <p className="font-semibold text-brand-700">
                              {formatTimeTz(new Date(appt.start_time), tz)}
                            </p>
                            <p className="mt-0.5 text-xs capitalize text-stone-400">
                              {new Date(appt.start_time).toLocaleDateString("es-PA", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                timeZone: tz,
                              })}
                            </p>
                          </>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          STATUS_BADGE[appt.status] ?? "bg-stone-50 text-stone-500 border-stone-200"
                        )}>
                          {STATUS_LABEL[appt.status] ?? appt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {sentAt ? (
                          <div className="space-y-1">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              sentToday
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-stone-200 bg-stone-50 text-stone-600"
                            )}>
                              <Clock className="h-3 w-3" />
                              {sentToday ? "Enviado hoy" : "Enviado"}
                            </span>
                            <p className="text-xs text-stone-400">{formatSentAt(sentAt, tz)}</p>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-700">Pendiente</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => copyMessage(appt)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50"
                          >
                            {copiedId === appt.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                            {copiedId === appt.id ? "Copiado" : "Copiar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openWhatsApp(appt)}
                            disabled={!hasPhone || sentToday}
                            title={sentToday ? "Recordatorio ya enviado hoy" : undefined}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                              hasPhone && !sentToday
                                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                : "border-stone-200 bg-stone-50 text-stone-300 cursor-not-allowed"
                            )}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => markAsSent(appt)}
                            disabled={sentToday || (isPending && sendingId === appt.id)}
                            title={sentToday ? "Recordatorio ya enviado hoy" : undefined}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                              sentToday
                                ? "border-stone-200 bg-stone-50 text-stone-300"
                                : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
                            )}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {sentToday
                              ? "Enviado"
                              : isPending && sendingId === appt.id
                                ? "Guardando"
                                : "Marcar enviado"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
