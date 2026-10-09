"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { AppointmentsCalendar } from "./appointments-calendar";
import { MobileAgenda } from "./mobile-agenda";
import { AppointmentDetailDialog } from "./dialogs/appointment-detail";
import { CompleteAppointmentDialog } from "./dialogs/complete-appointment";
import { CancelAppointmentDialog } from "./dialogs/cancel-appointment";
import { cn } from "@/lib/utils/cn";
import {
  CheckCircle2, ListFilter, MoreHorizontal, Pencil, Search, Trash2, X,
} from "lucide-react";
import type { CalView } from "./date-nav";
import type { CalendarAppointment, CalendarEmployee } from "@/features/appointments/view-models";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";

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
const SUMMARY_STATUS_ORDER: Record<string, number> = {
  scheduled: 0,
  confirmed: 1,
  completed: 2,
  no_show: 3,
  cancelled: 4,
};

export type ApptFull = CalendarAppointment;
type Employee = CalendarEmployee;

function appointmentTimeValue(appt: ApptFull): number {
  return appt.start_time ? new Date(appt.start_time).getTime() : Number.MAX_SAFE_INTEGER;
}

function formatAppointmentDayTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

function sortSummaryAppointments(appointments: ApptFull[], groupByStatus: boolean): ApptFull[] {
  return [...appointments].sort((a, b) => {
    if (groupByStatus) {
      const statusDiff =
        (SUMMARY_STATUS_ORDER[a.status] ?? 99) - (SUMMARY_STATUS_ORDER[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
    }

    const timeDiff = appointmentTimeValue(a) - appointmentTimeValue(b);
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });
}

export function AppointmentsDayView({
  appointments, tz, canManage,
  view = "diaria", weekDates, employees = [],
  businessStart, businessEnd, salonName, cancellationTemplate, paymentMethodOptions,
}: {
  appointments: ApptFull[];
  tz: string;
  canManage: boolean;
  view?: CalView;
  weekDates?: string[];
  employees?: Employee[];
  businessStart?: number;
  businessEnd?: number;
  salonName: string;
  cancellationTemplate: string;
  paymentMethodOptions: PaymentMethodOption[];
}) {
  const [summaryFilter, setSummaryFilter] = useState<"upcoming" | "completed" | "cancelled">("upcoming");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [detailAppt, setDetailAppt] = useState<ApptFull | null>(null);
  const [completeAppt, setCompleteAppt] = useState<ApptFull | null>(null);
  const [cancelAppt, setCancelAppt] = useState<ApptFull | null>(null);

  // Worker search
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  const filteredEmps = useMemo(() => {
    if (!empSearch) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter((e) =>
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q)
    );
  }, [employees, empSearch]);

  // Filter appointments by selected employee (trabajador view)
  const calendarAppts = useMemo(() => {
    if (view !== "trabajador" || !selectedEmpId) return appointments;
    return appointments.filter((a) =>
      a.items.some((it) => it.employee?.id === selectedEmpId)
    );
  }, [appointments, view, selectedEmpId]);

  const statusFilters = [
    { value: "upcoming" as const, label: "Citas próximas" },
    { value: "completed" as const, label: "Completadas" },
    { value: "cancelled" as const, label: "Canceladas" },
  ];

  const listAppts = useMemo(() => {
    const filtered = appointments.filter((appointment) => {
      if (summaryFilter === "upcoming") {
        return appointment.status === "scheduled" || appointment.status === "confirmed";
      }
      return appointment.status === summaryFilter;
    });

    return sortSummaryAppointments(filtered, false);
  }, [appointments, summaryFilter]);

  const calendarTitle =
    view === "trabajador" && selectedEmp
      ? `${selectedEmp.first_name} ${selectedEmp.last_name}`
      : undefined;

  return (
    <div className="space-y-6">
      {/* Worker search bar */}
      {view === "trabajador" && (
        <div className="relative">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-surface shadow-sm px-4 py-3">
            <Search className="h-4 w-4 text-fg-subtle shrink-0" />
            <input
              type="text"
              placeholder="Buscar profesional por nombre..."
              value={selectedEmp
                ? `${selectedEmp.first_name} ${selectedEmp.last_name}`
                : empSearch}
              onChange={(e) => {
                if (selectedEmpId) setSelectedEmpId(null);
                setEmpSearch(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              className="flex-1 text-sm text-fg-secondary placeholder:text-fg-subtle outline-none bg-transparent"
            />
            {selectedEmpId ? (
              <button
                onClick={() => { setSelectedEmpId(null); setEmpSearch(""); }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-sunken text-fg-muted hover:bg-danger-subtle hover:text-danger-strong transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="text-xs text-fg-subtle">{employees.length} profesionales</span>
            )}
          </div>

          {dropdownOpen && !selectedEmpId && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
              {filteredEmps.length === 0 ? (
                <p className="px-4 py-3 text-sm text-fg-subtle">Sin resultados</p>
              ) : (
                filteredEmps.map((emp) => (
                  <button
                    key={emp.id}
                    className="w-full text-left px-4 py-2.5 text-sm text-fg-secondary hover:bg-brand-50 hover:text-brand-700 transition-colors"
                    onMouseDown={() => {
                      setSelectedEmpId(emp.id);
                      setEmpSearch("");
                      setDropdownOpen(false);
                    }}
                  >
                    {emp.first_name} {emp.last_name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Calendario: grilla horaria en pantallas medianas/grandes, agenda en
          lista en el teléfono (la grilla no es usable en pantallas chicas). */}
      <div className="hidden sm:block">
        <AppointmentsCalendar
          appointments={calendarAppts}
          tz={tz}
          onApptClick={setDetailAppt}
          mode={view === "semanal" ? "semanal" : "diaria"}
          weekDates={view === "semanal" ? weekDates : undefined}
          title={calendarTitle}
          businessStart={businessStart}
          businessEnd={businessEnd}
        />
      </div>
      <div className="sm:hidden">
        <MobileAgenda appointments={calendarAppts} tz={tz} onApptClick={setDetailAppt} />
      </div>

      {/* Appointment list */}
      <div className="rounded-2xl border border-brand-100 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.07)] overflow-visible">
        <div className="rounded-t-2xl border-b border-brand-100 bg-surface px-5 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <nav className="flex items-end gap-8" aria-label="Filtros del resumen de citas">
              {statusFilters.map((f) => (
                <button
                  key={String(f.value)}
                  onClick={() => setSummaryFilter(f.value)}
                  className={cn(
                    "relative shrink-0 px-0.5 pb-3 text-sm font-medium transition-colors",
                    summaryFilter === f.value
                      ? "text-brand-700 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600"
                      : "text-fg-subtle hover:text-fg-secondary"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </nav>
            <h2 className="flex items-center gap-1.5 pb-3 text-sm font-semibold text-brand-700 uppercase tracking-wide">
              <ListFilter className="h-3.5 w-3.5" />
              Resumen de citas
            </h2>
          </div>
        </div>

        {listAppts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-fg-subtle">No hay citas para este filtro.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {listAppts.map((appt) => (
              <div
                key={appt.id}
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

                {canManage && !["completed", "cancelled", "no_show"].includes(appt.status) && (
                  <div className="relative ml-2 flex shrink-0 items-center gap-2.5">
                    <button
                      onClick={() => setCompleteAppt(appt)}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-success-border bg-success-subtle px-3 text-xs font-semibold text-success-fg transition-colors hover:bg-success-subtle focus:outline-none focus:ring-2 focus:ring-success"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completar
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenActionsId(openActionsId === appt.id ? null : appt.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label="Abrir acciones de cita"
                      aria-expanded={openActionsId === appt.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openActionsId === appt.id && (
                      <div className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                        <Link
                          href={`/appointments/${appt.id}/edit`}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-fg-secondary transition-colors hover:bg-brand-50 hover:text-brand-700"
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionsId(null);
                            setCancelAppt(appt);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-danger-strong transition-colors hover:bg-danger-subtle"
                        >
                          <Trash2 className="h-4 w-4" /> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {detailAppt && (
        <AppointmentDetailDialog
          appt={detailAppt}
          tz={tz}
          open={!!detailAppt}
          onClose={() => setDetailAppt(null)}
          canManage={canManage}
          onComplete={() => {
            setCompleteAppt(detailAppt);
            setDetailAppt(null);
          }}
          onCancel={() => {
            setCancelAppt(detailAppt);
            setDetailAppt(null);
          }}
        />
      )}
      {completeAppt && (
        <CompleteAppointmentDialog
          appt={completeAppt} open={!!completeAppt} onClose={() => setCompleteAppt(null)}
          paymentMethodOptions={paymentMethodOptions}
        />
      )}
      {cancelAppt && (
        <CancelAppointmentDialog
          appt={cancelAppt}
          open={!!cancelAppt}
          onClose={() => setCancelAppt(null)}
          tz={tz}
          salonName={salonName}
          template={cancellationTemplate}
        />
      )}
    </div>
  );
}
