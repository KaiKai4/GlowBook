"use client";

import { useState, useMemo } from "react";
import { AppointmentsCalendar } from "./appointments-calendar";
import { MobileAgenda } from "./mobile-agenda";
import { AppointmentDetailDialog } from "./dialogs/appointment-detail";
import { CompleteAppointmentDialog } from "./dialogs/complete-appointment";
import { CancelAppointmentDialog } from "./dialogs/cancel-appointment";
import type { CalView } from "./date-nav";
import type { CalendarAppointment, CalendarEmployee } from "@/features/appointments/view-models";
import type { PaymentMethodOption } from "@/features/payments/domain/payment-methods";
import { filterAppointmentsByEmployee } from "./day-view-data";
import { WorkerSearchBar } from "./day-view-worker-search";
import { AppointmentsSummary } from "./day-view-summary";

export type ApptFull = CalendarAppointment;
type Employee = CalendarEmployee;

export function AppointmentsDayView({
  appointments, canManage,
  view = "diaria", weekDates, employees = [],
  businessStart, businessEnd, cancellationTemplate, paymentMethodOptions,
}: {
  appointments: ApptFull[];
  canManage: boolean;
  view?: CalView;
  weekDates?: string[];
  employees?: Employee[];
  businessStart?: number;
  businessEnd?: number;
  cancellationTemplate: string;
  paymentMethodOptions: PaymentMethodOption[];
}) {
  const [detailAppt, setDetailAppt] = useState<ApptFull | null>(null);
  const [completeAppt, setCompleteAppt] = useState<ApptFull | null>(null);
  const [cancelAppt, setCancelAppt] = useState<ApptFull | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  // Filter appointments by selected employee (trabajador view)
  const calendarAppts = useMemo(() => {
    if (view !== "trabajador" || !selectedEmpId) return appointments;
    return filterAppointmentsByEmployee(appointments, selectedEmpId);
  }, [appointments, view, selectedEmpId]);

  const calendarTitle =
    view === "trabajador" && selectedEmp
      ? `${selectedEmp.first_name} ${selectedEmp.last_name}`
      : undefined;

  return (
    <div className="space-y-6">
      {view === "trabajador" && (
        <WorkerSearchBar
          employees={employees}
          selectedEmpId={selectedEmpId}
          selectedEmp={selectedEmp}
          onSelect={setSelectedEmpId}
        />
      )}

      {/* Calendario: grilla horaria en pantallas medianas/grandes, agenda en
          lista en el teléfono (la grilla no es usable en pantallas chicas). */}
      <div className="hidden sm:block">
        <AppointmentsCalendar
          appointments={calendarAppts}
          onApptClick={setDetailAppt}
          mode={view === "semanal" ? "semanal" : "diaria"}
          weekDates={view === "semanal" ? weekDates : undefined}
          title={calendarTitle}
          businessStart={businessStart}
          businessEnd={businessEnd}
        />
      </div>
      <div className="sm:hidden">
        <MobileAgenda appointments={calendarAppts} onApptClick={setDetailAppt} />
      </div>

      <AppointmentsSummary
        appointments={appointments}
        canManage={canManage}
        onComplete={setCompleteAppt}
        onCancel={setCancelAppt}
      />

      {detailAppt && (
        <AppointmentDetailDialog
          appt={detailAppt}
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
          template={cancellationTemplate}
        />
      )}
    </div>
  );
}
