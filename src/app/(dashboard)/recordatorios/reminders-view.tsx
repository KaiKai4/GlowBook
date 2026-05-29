"use client";

import { useState, useMemo } from "react";
import { formatTimeTz } from "@/lib/utils/dates";
import { MessageCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { renderMessageTemplate } from "@/features/notifications/domain/templates";
import type {
  ReminderAppointment,
  ReminderEmployee,
} from "@/features/reminders/view-models";

type ApptReminder = ReminderAppointment;

type Period = "hoy" | "manana" | "48h" | "7dias";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "manana", label: "Mañana" },
  { value: "48h", label: "Próximas 48 horas" },
  { value: "7dias", label: "Próximos 7 días" },
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

function todayStr(tz: string) { return localDateStr(new Date().toISOString(), tz); }
function tomorrowStr(tz: string) {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return localDateStr(d.toISOString(), tz);
}

function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function RemindersView({
  appointments,
  employees,
  tz,
  salonName,
  template,
}: {
  appointments: ApptReminder[];
  employees: ReminderEmployee[];
  tz: string;
  salonName: string;
  template: string;
}) {
  const [period, setPeriod] = useState<Period>("7dias");
  const [empId, setEmpId] = useState("");
  const [status, setStatus] = useState("");

  // applied mirrors the pending selects only after clicking Filtrar.
  // Initialised to match the default select values so the table is consistent on first render.
  const [applied, setApplied] = useState<{ period: Period; empId: string; status: string }>({
    period: "7dias", empId: "", status: "",
  });

  function applyFilters() {
    setApplied({ period, empId, status });
  }

  // Detect if pending selections differ from what's applied (so user knows to click Filtrar)
  const isDirty =
    period !== applied.period || empId !== applied.empId || status !== applied.status;

  const filtered = useMemo(() => {
    const now = new Date();
    const today = todayStr(tz);
    const tomorrow = tomorrowStr(tz);
    const cutoff48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    return appointments.filter((appt) => {
      if (!appt.start_time) return false;
      const apptDate = localDateStr(appt.start_time, tz);
      const apptTime = new Date(appt.start_time);

      // Period filter
      if (applied.period === "hoy" && apptDate !== today) return false;
      if (applied.period === "manana" && apptDate !== tomorrow) return false;
      if (applied.period === "48h" && apptTime > cutoff48) return false;

      // Collaborator filter
      if (applied.empId && !appt.items.some((it) => it.employee?.id === applied.empId)) return false;

      // Status filter
      if (applied.status && appt.status !== applied.status) return false;

      return true;
    });
  }, [appointments, applied, tz]);

  function sendReminder(appt: ApptReminder) {
    if (!appt.customer?.phone || !appt.start_time) return;
    const time = formatTimeTz(new Date(appt.start_time), tz);
    const dateLabel = new Date(appt.start_time).toLocaleDateString("es-PA", {
      weekday: "long", day: "numeric", month: "long", timeZone: tz,
    });
    const services = appt.items.map((it) => it.service?.name).filter(Boolean).join(", ") || "Servicios de belleza";
    const collaborators = [...new Set(
      appt.items
        .map((it) => it.employee ? `${it.employee.first_name} ${it.employee.last_name}` : null)
        .filter(Boolean)
    )].join(", ") || "nuestro equipo";
    const msg = renderMessageTemplate(template, {
      cliente: appt.customer.first_name,
      fecha: dateLabel,
      hora: time,
      servicios: services,
      colaboradores: collaborators,
      salon: salonName,
    });
    window.open(buildWhatsAppUrl(appt.customer.phone, msg), "_blank");
  }

  const selectClass = "h-10 rounded-xl border border-stone-200 bg-white px-3 pr-8 text-sm text-stone-700 appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer";

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
        {/* Period */}
        <div className="flex flex-col gap-1.5 min-w-[180px] flex-1">
          <label className="text-xs font-medium text-stone-500">Período</label>
          <div className="relative">
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={selectClass}>
              {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">▾</span>
          </div>
        </div>

        {/* Colaborador */}
        <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
          <label className="text-xs font-medium text-stone-500">Profesional</label>
          <div className="relative">
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} className={selectClass}>
              <option value="">Todos los colaboradores</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">▾</span>
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5 min-w-[180px] flex-1">
          <label className="text-xs font-medium text-stone-500">Estado</label>
          <div className="relative">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">▾</span>
          </div>
        </div>

        {/* Apply button */}
        <button
          onClick={applyFilters}
          className={cn(
            "h-10 rounded-xl px-6 text-sm font-semibold text-white transition-all shrink-0",
            isDirty
              ? "bg-brand-600 hover:bg-brand-700 shadow-[0_0_0_3px_rgba(124,58,237,0.2)]"
              : "bg-choco-600 hover:bg-choco-700"
          )}
        >
          {isDirty ? "Aplicar filtros" : "Filtrar"}
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-100 px-5 py-3">
        <Bell className="h-4 w-4 text-brand-500 shrink-0" />
        <p className="text-sm font-semibold text-brand-700">
          {filtered.length} {filtered.length === 1 ? "cita" : "citas"} pendiente{filtered.length !== 1 ? "s" : ""} de recordatorio
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="h-8 w-8 text-stone-200 mx-auto mb-3" />
            <p className="text-sm text-stone-400">Sin citas para estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {["Cliente", "Colaborador", "Servicios", "Fecha", "Estado", "Recordatorio"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((appt) => {
                  const customerName = appt.customer
                    ? `${appt.customer.first_name} ${appt.customer.last_name}`
                    : "—";
                  const hasPhone = !!appt.customer?.phone;
                  const empNames = [...new Set(
                    appt.items.map((it) => it.employee ? `${it.employee.first_name} ${it.employee.last_name}` : null).filter(Boolean)
                  )].join(", ");

                  return (
                    <tr key={appt.id} className="hover:bg-stone-50/60 transition-colors">
                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-800">{customerName}</p>
                        {appt.customer?.phone && (
                          <p className="text-xs text-stone-400 mt-0.5">{appt.customer.phone}</p>
                        )}
                      </td>

                      {/* Colaborador */}
                      <td className="px-4 py-3 text-stone-700">{empNames || "—"}</td>

                      {/* Servicios */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {appt.items.map((it) => it.service && (
                            <span key={it.id} className="rounded-full bg-choco-50 border border-choco-100 px-2 py-0.5 text-[11px] text-choco-700 font-medium whitespace-nowrap">
                              {it.service.name}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {appt.start_time ? (
                          <>
                            <p className="font-semibold text-brand-700">
                              {formatTimeTz(new Date(appt.start_time), tz)}
                            </p>
                            <p className="text-xs text-stone-400 mt-0.5 capitalize">
                              {new Date(appt.start_time).toLocaleDateString("es-PA", {
                                weekday: "short", day: "numeric", month: "short", timeZone: tz,
                              })}
                            </p>
                          </>
                        ) : "—"}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          STATUS_BADGE[appt.status] ?? "bg-stone-50 text-stone-500 border-stone-200"
                        )}>
                          {STATUS_LABEL[appt.status] ?? appt.status}
                        </span>
                      </td>

                      {/* Recordatorio */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => sendReminder(appt)}
                          disabled={!hasPhone}
                          title={hasPhone ? "Enviar recordatorio por WhatsApp" : "Cliente sin teléfono"}
                          className={cn(
                            "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                            hasPhone
                              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                              : "border-stone-200 bg-stone-50 text-stone-300 cursor-not-allowed"
                          )}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="border-t border-stone-100 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-stone-400">
                {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
              </p>
              <p className="text-xs text-stone-400">
                Total: <span className="font-semibold text-stone-600">
                  {filtered.reduce((s, a) => s + Number(a.total_price ?? 0), 0).toLocaleString("es-PA", { style: "currency", currency: "USD" })}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
