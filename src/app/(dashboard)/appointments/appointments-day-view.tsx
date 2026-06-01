"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatTimeTz } from "@/lib/utils/dates";
import { AppointmentsCalendar } from "./appointments-calendar";
import { AppointmentDetailDialog } from "./dialogs/appointment-detail";
import { CompleteAppointmentDialog } from "./dialogs/complete-appointment";
import { CancelAppointmentDialog } from "./dialogs/cancel-appointment";
import { confirmAppointmentAction } from "./actions";
import { cn } from "@/lib/utils/cn";
import {
  CheckCircle2, XCircle, ThumbsUp, Eye, ListFilter, Search, X, Pencil,
} from "lucide-react";
import type { CalView } from "./date-nav";
import type { CalendarAppointment, CalendarEmployee } from "@/features/appointments/view-models";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Completada",
  cancelled: "Cancelada", no_show: "No asistió",
};
const STATUS_ROW_BG: Record<string, string> = {
  completed: "bg-emerald-50/40", cancelled: "opacity-50", no_show: "bg-amber-50/40",
};
const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-brand-50 text-brand-700 border-brand-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-stone-100 text-stone-500 border-stone-200",
  no_show: "bg-amber-50 text-amber-700 border-amber-200",
};

export type ApptFull = CalendarAppointment;
type Employee = CalendarEmployee;

export function AppointmentsDayView({
  appointments, tz, canManage,
  view = "diaria", weekDates, employees = [],
  businessStart, businessEnd, salonName, cancellationTemplate,
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
}) {
  const router = useRouter();
  const [pending, startConfirm] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
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

  function handleConfirm(apptId: string) {
    setConfirmingId(apptId);
    startConfirm(async () => {
      await confirmAppointmentAction(apptId);
      setConfirmingId(null);
      router.refresh();
    });
  }

  const statusFilters = [
    { value: null, label: "Todas" },
    { value: "scheduled", label: "Agendadas" },
    { value: "confirmed", label: "Confirmadas" },
    { value: "completed", label: "Completadas" },
    { value: "cancelled", label: "Canceladas" },
  ];

  const listAppts = filterStatus
    ? appointments.filter((a) => a.status === filterStatus)
    : appointments;

  const calendarTitle =
    view === "trabajador" && selectedEmp
      ? `${selectedEmp.first_name} ${selectedEmp.last_name}`
      : undefined;

  return (
    <div className="space-y-6">
      {/* Worker search bar */}
      {view === "trabajador" && (
        <div className="relative">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white shadow-sm px-4 py-3">
            <Search className="h-4 w-4 text-stone-400 shrink-0" />
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
              className="flex-1 text-sm text-stone-800 placeholder:text-stone-400 outline-none bg-transparent"
            />
            {selectedEmpId ? (
              <button
                onClick={() => { setSelectedEmpId(null); setEmpSearch(""); }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="text-xs text-stone-400">{employees.length} profesionales</span>
            )}
          </div>

          {dropdownOpen && !selectedEmpId && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-stone-200 bg-white shadow-xl overflow-hidden">
              {filteredEmps.length === 0 ? (
                <p className="px-4 py-3 text-sm text-stone-400">Sin resultados</p>
              ) : (
                filteredEmps.map((emp) => (
                  <button
                    key={emp.id}
                    className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
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

      {/* Calendar */}
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

      {/* Appointment list */}
      <div className="rounded-2xl border border-brand-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.07)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-stone-200 bg-gradient-to-r from-choco-50 to-white">
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
                    ? "border-brand-400 bg-brand-50 text-brand-700"
                    : "border-stone-200 text-stone-600 hover:bg-stone-50"
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
                <div className="w-24 shrink-0">
                  {appt.start_time && (
                    <p className="text-sm font-bold text-brand-700 tabular-nums">
                      {formatTimeTz(new Date(appt.start_time), tz)}
                    </p>
                  )}
                  {appt.end_time && (
                    <p className="text-xs text-stone-500 tabular-nums">
                      – {formatTimeTz(new Date(appt.end_time), tz)}
                    </p>
                  )}
                </div>

                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-semibold text-stone-800">
                    {appt.customer?.first_name} {appt.customer?.last_name}
                  </p>
                  {appt.customer?.phone && (
                    <p className="text-xs text-stone-500">{appt.customer.phone}</p>
                  )}
                </div>

                <div className="flex-1 min-w-[160px]">
                  <div className="flex flex-wrap gap-1">
                    {appt.items.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-choco-50 border border-choco-100 px-2 py-0.5 text-[11px] text-choco-700 font-medium"
                      >
                        {item.service?.name} · {item.employee?.first_name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[appt.status] ?? ""}`}>
                    {STATUS_LABEL[appt.status]}
                  </span>
                  <span className="text-sm font-bold text-stone-700">
                    {formatCurrency(Number(appt.total_price ?? 0))}
                  </span>
                </div>

                {canManage && !["completed", "cancelled", "no_show"].includes(appt.status) && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setDetailAppt(appt)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
                      title="Ver detalle"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      href={`/appointments/${appt.id}/edit`}
                      className="flex h-8 items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Link>
                    {appt.status === "scheduled" && (
                      <button
                        onClick={() => handleConfirm(appt.id)}
                        disabled={pending && confirmingId === appt.id}
                        className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> Confirmar
                      </button>
                    )}
                    <button
                      onClick={() => setCompleteAppt(appt)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completar
                    </button>
                    <button
                      onClick={() => setCancelAppt(appt)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
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

      {detailAppt && (
        <AppointmentDetailDialog
          appt={detailAppt}
          tz={tz}
          open={!!detailAppt}
          onClose={() => setDetailAppt(null)}
          canManage={canManage}
        />
      )}
      {completeAppt && (
        <CompleteAppointmentDialog
          appt={completeAppt} open={!!completeAppt} onClose={() => setCompleteAppt(null)}
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
